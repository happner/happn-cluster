var sm = require("happner-serial-mocha");
var path = require("path");
var fs = require("fs");

var testDir = path.resolve(__dirname, '../');

var testDirs = [
  testDir + path.sep + 'test-func',
  testDir + path.sep + 'test-unit'
];

var files = [];

testDirs.forEach(function (testDir) {

  fs.readdirSync(testDir).forEach(function (filename) {

    var filePath = testDir + path.sep + filename;
    var file = fs.statSync(filePath);

    if (!file.isDirectory()) files.push(filePath);

  });

});

var reportDir = path.resolve(__dirname, '../reports');

sm.runTasks(files, true, true, reportDir)

//sm.runTasks(files, 'lib/serialReporter.js', true)

.then(function(results){
  console.log('tests completed, check the latest report file in ' + reportDir);
})

.catch(function(e){
  console.log('broke:::', e);
});
