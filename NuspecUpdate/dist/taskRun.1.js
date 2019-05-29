"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var tl = require("azure-pipelines-task-lib");
var xpar = require("xml-parser");
var fileData = require("./getFSData");
var validInputs = false;
var input_nuspecFile = "";
var input_projectFile = "";
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
                    var xmlObject;
                    return tslib_1.__generator(this, function (_a) {
                        try {
                            xmlObject = xpar(xmlDatastring);
                            resolve(xmlObject);
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
function DoWork(projectFileName, nuspecFileName) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var projectFileData, projectXMLObj, nuspecXMLObj, itmGroups, pkgRefs;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fileData.OpenFile(projectFileName)];
                case 1:
                    projectFileData = _a.sent();
                    return [4 /*yield*/, GetXMLFileData(projectFileData)];
                case 2:
                    projectXMLObj = _a.sent();
                    itmGroups = ProcessProjectXMLFile(projectXMLObj);
                    pkgRefs = new Array();
                    pkgRefs = processItemGroups(itmGroups);
                    tl.debug("found " + pkgRefs.length.toString() + " package references");
                    if (pkgRefs.length > 0) {
                        nuspecXMLObj = GetXMLFileData(nuspecFileName);
                    }
                    return [2 /*return*/];
            }
        });
    });
}
exports.DoWork = DoWork;
function ProcessProjectXMLFile(projectXMLObj) {
    if (projectXMLObj != null) {
        if (projectXMLObj.root != null) {
            if (projectXMLObj.root.children != null) {
                var itmGroups = FindItemGroups(projectXMLObj.root.children);
            }
            else {
                tl.error("The Project file may not be valid, there are no children in the root xml");
            }
        }
        else {
            tl.error("The Project File may not be valid, there is no root xml node?");
        }
    }
    else {
        tl.error("Could not read the Project file!");
    }
    return itmGroups;
}
//FindItemGroups  -- Find ItemGroup nodes in the list
function FindItemGroups(nodes) {
    var itmGroups = new Array();
    try {
        itmGroups = GetNodesByName(nodes, "ItemGroup");
    }
    catch (err) {
        tl.error("Error while attempting to find Item Groups in the Project XML");
    }
    return itmGroups;
}
//processItemGroups - Process the list of ItemGroup nodes that were found in the project
function processItemGroups(itmGroups) {
    var pkgRefList = new Array();
    itmGroups.forEach(function (thisItmGroup) {
        pkgRefList = pkgRefList.concat(FindPackageReferences(thisItmGroup.children));
    });
    return pkgRefList;
}
//FindPackageReferences - find ay PackageReference nodes in the list 
function FindPackageReferences(nodes) {
    var pkgRef = new Array();
    try {
        pkgRef = GetNodesByName(nodes, "PackageReference");
    }
    catch (err) {
        tl.error("Error while attempting to find Package References in the Project XML");
    }
    return pkgRef;
}
function ProcessNuspecFile(nuspecData) {
    var pkgDependencies = new Array();
    if (nuspecData != null) {
        if (nuspecData.root != null) {
            if (nuspecData.root.children != null) {
                var metadataNode = GetNuSpecMetadataNode(nuspecData.root.children);
                var dependenciesNode = GetNodesByName(metadataNode.children, "dependencies");
            }
            else {
                tl.error("The Nuspec file may not be valid, there were no root children");
            }
        }
        else {
            tl.error("The Nuspec file may not be valid, there was no root object?");
        }
    }
    else {
        tl.error("the Nuspec file is not valid, there was not any valid xml?");
    }
    return pkgDependencies;
}
function GetNuSpecMetadataNode(nuspecRootChildren) {
    try {
        var metadataNode = GetNodesByName(nuspecRootChildren, "metadata");
    }
    catch (err) {
        tl.error("error getting nuspec metadatanode");
    }
    return metadataNode;
}
function GetNodesByName(nodeChildren, nodeName) {
    var nodeListForName = new Array();
    try {
        nodeChildren.forEach(function (thisNode) {
            if (thisNode.name == nodeName) {
                nodeListForName.push(thisNode);
                tl.debug("found node " + nodeName);
            }
        });
    }
    catch (err) {
        tl.debug(err);
        tl.error("Error while attempting to find node name " + nodeName);
        tl.error("List received to search : " + nodeChildren.toString());
    }
    return nodeListForName;
}
///Run function to handle the async running process of the task
function Run() {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var fileContent;
        return tslib_1.__generator(this, function (_a) {
            console.log("Reading JSON file to generate variables for future tasks... ");
            validateInputs();
            fileContent = "";
            try {
                if (validInputs) {
                    // var contentObj:any = await getFileJSONData();
                    // var result:boolean =  await processJson.ProcessKeys(contentObj, input_variablePrefix, input_shouldPrefixVariables);
                }
                else {
                    tl.setResult(tl.TaskResult.Failed, "Invalid Inputs");
                }
            }
            catch (err) {
                tl.error(err);
                tl.setResult(tl.TaskResult.Failed, "processing JSON failed");
            }
            return [2 /*return*/];
        });
    });
}
//# sourceMappingURL=taskRun.1.js.map