const fs = require('vinyl-fs');
const path = require('path')

var outDir = "./dist";

fs.src(['./package.dist.json']).on('data', function (file) {
    // Manually rename the file
    file.path = path.join(file.base, 'package.json');
}).pipe(fs.dest(outDir));