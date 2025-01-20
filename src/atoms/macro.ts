import { Atom } from '../core/atom-class';
import { Context } from '../core/context';
import { Box } from '../core/box';
import type { Style } from '../public/core-types';
import type { AtomJson, ToLatexOptions } from 'core/types';

export class MacroAtom extends Atom {
  private _macroArgs: null | string;

  get macroArgs(): null | string {
    return this._macroArgs;
  }

  // If false, even if `expandMacro` is true, do not expand.
  private readonly expand: boolean;
  private readonly def: string;

  constructor(
    macro: string,
    options: {
      expand?: boolean;
      args: null | string;
      body: Readonly<Atom[]>;
      captureSelection?: boolean;
      style: Style;
      def: string;
    }
  ) {
    super({ type: 'macro', command: macro, style: options.style });
    this.body = options.body;
    // Set the `captureSelection` attribute to true so that the atom is handled
    // as an unbreakable unit
    if (options.captureSelection === undefined) {
      if (options.args) this.captureSelection = false;
      else this.captureSelection = true;
    } else this.captureSelection = options.captureSelection;

    // Don't use verbatimLatex to save the macro, as it can get wiped when
    // the atom is modified (adding super/subscript, for example).
    this._macroArgs = options.args;

    this.expand = options.expand ?? false;
    this.def = options.def;
  }

  static fromJson(json: AtomJson): MacroAtom {
    return new MacroAtom(json.command, json as any);
  }

  toJson(): AtomJson {
    const options = super.toJson();
    if (this.expand) options.expand = true;
    if (this.captureSelection !== undefined)
      options.captureSelection = this.captureSelection;
    if (this.macroArgs) options.args = this.macroArgs;
    options.def = this.def;
    return options;
  }

  _serialize(options: ToLatexOptions): string {
    return options.expandMacro && this.expand
      ? this.bodyToLatex(options)
      : this.command + (this.macroArgs ?? '');
  }

  applyStyle(style: Style, options?: { unstyledOnly: boolean }): void {
    // For macros, we only allow color styling. The macro itself has control
    // over the other style attributes
    const allowedStyle: Style = {};
    if (style.color) allowedStyle.color = style.color;
    if (style.backgroundColor)
      allowedStyle.backgroundColor = style.backgroundColor;

    super.applyStyle(allowedStyle, options);
  }

  render(context: Context): Box | null {
    const result = Atom.createBox(context, this.body, { type: 'lift' });
    if (!result) return null;
    if (this.caret) result.caret = this.caret;
    return this.bind(context, result);
  }

  reloadArgs(): void {
    const bodyLatex = this.bodyToLatex({
      expandMacro: false,
      defaultMode: 'math',
    });
    const args = extractArgumentsWithOrder(this.def, bodyLatex);
    this._macroArgs = args?.map((arg) => `{${arg || ''}}`).join('') ?? null;
  }
}

export class MacroArgumentAtom extends Atom {
  constructor() {
    super({ type: 'macro-argument' });
  }

  static fromJson(_json: AtomJson): MacroArgumentAtom {
    return new MacroArgumentAtom();
  }

  toJson(): AtomJson {
    const options = super.toJson();
    return options;
  }

  _serialize(_options: ToLatexOptions): string {
    return '';
  }

  render(_context: Context): Box | null {
    // const result = Atom.createBox(context, this.body);
    // if (!result) return null;
    // if (this.caret) result.caret = this.caret;
    // return this.bind(context, result);

    return null;
  }
}

export function reloadParentsMacros(parent: Atom | undefined): void {
  while (parent) {
    if (parent.type === 'macro' && parent instanceof MacroAtom)
      parent.reloadArgs();
    parent = parent.parent;
  }
}

function extractArgumentsWithOrder(
  template: string,
  inputString: string
): string[] | null {
  if (!template) throw new Error('No template provided');
  if (!inputString) return null;

  // Escape special regex characters in the template
  let escapedTemplate = template.replace(/([.*+?^${}()|[\]\\])/g, '\\$1');

  // Create an array to track the placeholders in the correct order
  const placeholders: string[] = [];
  const placeholderRegex = /\#(\d+)/g;
  let match: RegExpExecArray | null;

  // Find all placeholders in the order they appear in the template
  while ((match = placeholderRegex.exec(template)) !== null) {
    placeholders.push(`\#${match[1]}`);
    // Replace the placeholder in the template with a regex capture group
    escapedTemplate = escapedTemplate.replace(
      new RegExp(`\#${match[1]}`, 'g'),
      '(.*?)'
    );
  }

  // Create the regex from the escaped template
  const regex = new RegExp(`^${escapedTemplate}$`);

  // Match the input string
  const matchResult = inputString.match(regex);

  // If a match is found, map placeholders to their corresponding values
  if (matchResult) {
    const output: Record<string, string> = {};
    placeholders.forEach((placeholder, index) => {
      output[placeholder] = matchResult[index + 1]; // Offset by 1 because result[0] is the full match
    });

    // extract result to array
    const result = new Array(8)
      .fill(0)
      .map((_, i) => output[`#${i + 1}`]?.trim());
    while (result.length && result[result.length - 1] === undefined)
      result.pop();

    return result;
  }

  return null; // No match found
}
