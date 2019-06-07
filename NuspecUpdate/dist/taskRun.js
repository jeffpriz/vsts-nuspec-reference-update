"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var tl = require("azure-pipelines-task-lib");
var fileData = require("./getFSData");
var dep = require("./nuspecDependencyClass");
var validInputs = false;
var input_nuspecFile = "";
var input_projectFile = "";
Run();
//=----------------------------------------------------------
//=  Validate that the inputs were provided as expected
//=----------------------------------------------------------
function validateInputs() {
    //File name input
    tl.debug("validating inputs...");
    validInputs = true;
    try {
        input_nuspecFile = tl.getPathInput('nuspecFile', true);
    }
    catch (ex) {
        tl.error("a Nuspec file is a required input to this task, but was not supplied");
        validInputs = false;
    }
    try {
        input_projectFile = tl.getPathInput('projectFile', true);
    }
    catch (ex) {
        tl.error("a project file is a required input to this task, but was not supplied");
        validInputs = false;
    }
}
function GetXMLFileData(xmlDatastring) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var _this = this;
        return tslib_1.__generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve, reject) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                    var DOMParser, doc;
                    return tslib_1.__generator(this, function (_a) {
                        try {
                            DOMParser = require('xmldom').DOMParser;
                            doc = new DOMParser().parseFromString(xmlDatastring);
                            //var xmlObject:any = xpar(xmlDatastring);          
                            resolve(doc);
                        }
                        catch (err) {
                            reject(err);
                        }
                        return [2 /*return*/];
                    });
                }); })];
        });
    });
}
//DoWork -- Main worker function that really will control logic flow for the task
function DoWork(projectFileName, nuspecFileName, overwriteExistingFile) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var projectFileData, projectXMLObj, nuspecXMLObj, nuspecDependenciesNode, success, projectPackageReferences, err_1, updatedNuspec, nuspecFileData, nuspecXMLObj, err_2, fileOutput;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    projectFileData = "";
                    projectXMLObj = "";
                    success = true;
                    projectPackageReferences = new Array();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, fileData.OpenFile(projectFileName)];
                case 2:
                    projectFileData = _a.sent();
                    return [4 /*yield*/, GetXMLFileData(projectFileData)];
                case 3:
                    projectXMLObj = _a.sent();
                    projectPackageReferences = ProcessProjectXMLFile(projectXMLObj);
                    return [3 /*break*/, 5];
                case 4:
                    err_1 = _a.sent();
                    success = false;
                    tl.error("Could not successfully process the Project file");
                    tl.error(err_1);
                    return [3 /*break*/, 5];
                case 5:
                    tl.debug("found " + projectPackageReferences.length.toString() + " package reference(s)");
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 10, , 11]);
                    if (!(projectPackageReferences.length > 0)) return [3 /*break*/, 9];
                    return [4 /*yield*/, fileData.OpenFile(nuspecFileName)];
                case 7:
                    nuspecFileData = _a.sent();
                    return [4 /*yield*/, GetXMLFileData(nuspecFileData)];
                case 8:
                    nuspecXMLObj = _a.sent();
                    updatedNuspec = ProcessNuspecData(nuspecXMLObj, projectPackageReferences);
                    _a.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    err_2 = _a.sent();
                    success = false;
                    tl.error("Could not successfully process the Nuspec data");
                    tl.error(err_2);
                    return [3 /*break*/, 11];
                case 11:
                    if (success) {
                        fileOutput = nuspecFileName;
                        if (!overwriteExistingFile) {
                            fileOutput = "testoutput.nuspec";
                        }
                        fileData.WriteFile(fileOutput, updatedNuspec);
                        tl.debug("Nuspec file Udpate written");
                    }
                    else {
                        tl.setResult(tl.TaskResult.Failed, "Processing failed, not writing NuSpec file");
                    }
                    return [2 /*return*/];
            }
        });
    });
}
exports.DoWork = DoWork;
//ProcessProjectXMLFile -- the goal is to extract all of the Pacakge Reference dependencies from this project to use to keep the Nuspec up to date
function ProcessProjectXMLFile(projectXMLObj) {
    var dependencies = new Array();
    tl.debug("Processing Project File for Item Groups and PacakgeReferences");
    if (projectXMLObj.documentElement != null) {
        if (projectXMLObj.documentElement.hasChildNodes("ItemGroup")) {
            var projectItemGroups = projectXMLObj.documentElement.getElementsByTagName("ItemGroup");
            tl.debug("There were ItemGroups found: " + projectItemGroups.length.toString());
            for (var ndx = 0; ndx < projectItemGroups.length; ndx++) {
                var thisItemGroup = projectItemGroups[ndx];
                dependencies = dependencies.concat(getDependencyFromItemGroup(thisItemGroup));
            }
        }
        else {
            tl.debug("Project File does not contain any ItemGroup elements");
        }
    }
    else {
        tl.error("Project XML has no root documentElement");
    }
    return dependencies;
}
//getDependencyFromItemGroup -- The Project file PacakgeReference elements live inside the ItemGroup elements, we will process through
//              the ItemGroup elements to extract those PackageReferences and gather the information we need to put in the Nuspec
function getDependencyFromItemGroup(itemgroupElement) {
    var groupDependencies = new Array();
    if (itemgroupElement.hasChildNodes("PackageReference")) {
        var packagReferenceElements = itemgroupElement.getElementsByTagName("PackageReference");
        for (var ndx = 0; ndx < packagReferenceElements.length; ndx++) {
            var thisPkgRef = packagReferenceElements[ndx];
            if (thisPkgRef.hasAttribute("Include") && thisPkgRef.hasAttribute("Version")) {
                var thisDependency = new dep.dependency(thisPkgRef.getAttribute("Include"), thisPkgRef.getAttribute("Version"));
                groupDependencies.push(thisDependency);
            }
            else if (thisPkgRef.hasAttribute("Include") && thisPkgRef.getElementsByTagName("Version")) {
                var thisDependency = new dep.dependency(thisPkgRef.getAttribute("Include"), thisPkgRef.getElementsByTagName("Version")[0].firstChild.nodeValue);
                groupDependencies.push(thisDependency);
            }
        }
    }
    return groupDependencies;
}
function ProcessNuspecData(nuspecXMLObj, projectDependencies) {
    if (nuspecXMLObj.documentElement != null) {
        if (nuspecXMLObj.documentElement.getElementsByTagName("metadata").length > 0) {
            var nuspecMetadataElement = nuspecXMLObj.documentElement.getElementsByTagName("metadata");
            if (nuspecMetadataElement[0].getElementsByTagName("dependencies").length > 0) {
                tl.debug("The nuspec currently has a dependencies node, we will clear it out to place project dependencies in");
                var dependenciesElement = nuspecMetadataElement[0].getElementsByTagName("dependencies");
                while (dependenciesElement[0].hasChildNodes()) {
                    dependenciesElement[0].removeChild(dependenciesElement[0].firstChild);
                }
                //for(var depNdx:number = dependenciesElement[0].getElementsByTagName("dependency").length; depNdx > 0; depNdx--)                
                //{                    
                //    dependenciesElement[0].removeChild(dependenciesElement[0].getElementsByTagName("dependency")[depNdx-1]);
                //}
                tl.debug(dependenciesElement.toString());
            }
            else {
                tl.debug("the nuspec does not have a dependencies node, will create one to place project dependencies in");
                var dependenciesElement = nuspecXMLObj.createElement("dependencies");
                nuspecMetadataElement[0].appendChild(dependenciesElement);
            }
            projectDependencies.forEach(function (thisPR) {
                var dependenciesElement = nuspecMetadataElement[0].getElementsByTagName("dependencies");
                var depElement = nuspecXMLObj.createElement("dependency");
                depElement.setAttribute("id", thisPR.id);
                depElement.setAttribute("version", thisPR.version);
                dependenciesElement[0].appendChild(depElement);
            });
        }
        else {
            tl.debug("The nuspec file had no metadata node, so no dependencies nodes are possible");
        }
    }
    else {
        tl.error("The nuspec file has no root element");
    }
    tl.debug("nuspecXML Now: " + nuspecXMLObj.toString());
    return nuspecXMLObj;
}
///Run function to handle the async running process of the task
function Run() {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var fileContent, err_3;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Reading JSON file to generate variables for future tasks... ");
                    validateInputs();
                    fileContent = "";
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    if (!validInputs) return [3 /*break*/, 3];
                    return [4 /*yield*/, DoWork(input_projectFile, input_nuspecFile, true)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    tl.setResult(tl.TaskResult.Failed, "Invalid Inputs");
                    _a.label = 4;
                case 4: return [3 /*break*/, 6];
                case 5:
                    err_3 = _a.sent();
                    tl.error(err_3);
                    tl.setResult(tl.TaskResult.Failed, "Processing dependencies for Nuspec failed");
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
//# sourceMappingURL=taskRun.js.map