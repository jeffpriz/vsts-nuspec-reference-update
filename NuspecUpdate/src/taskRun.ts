import * as tl from 'azure-pipelines-task-lib';
import * as xpar from 'xml-parser';
import * as fileData from './getFSData';
import * as dep from './nuspecDependencyClass';
import { runInContext } from 'vm';
import { deprecate } from 'util';

var validInputs:boolean = false;
var input_nuspecFile:string = "";
var input_projectFile:string="";

Run();

//=----------------------------------------------------------
//=  Validate that the inputs were provided as expected
//=----------------------------------------------------------
function validateInputs()
{
    //File name input
    tl.debug("validating inputs...");
    
    validInputs = true;
    try {
        input_nuspecFile = tl.getPathInput('nuspecFile',true);
        

    }
    catch(ex)
    {
        tl.error("a Nuspec file is a required input to this task, but was not supplied");
        validInputs = false;
    }

    try {
        input_projectFile = tl.getPathInput('projectFile',true);
        

    }
    catch(ex)
    {
        tl.error("a project file is a required input to this task, but was not supplied");
        validInputs = false;
    }
}



async function GetXMLFileData(xmlDatastring:string):Promise<any>
{
    return new Promise<any>(async (resolve, reject) => {      
       try 
       {
        var DOMParser = require('xmldom').DOMParser;
        var doc:any = new DOMParser().parseFromString(xmlDatastring);
        //var xmlObject:any = xpar(xmlDatastring);          

        resolve(doc);
       } 
       catch(err)
       {
           reject(err);
       }
    });

}


//DoWork -- Main worker function that really will control logic flow for the task
export async function DoWork(projectFileName:string, nuspecFileName:string, overwriteExistingFile:boolean)
{
    

    var projectFileData:string = "";
    var projectXMLObj:any =  "";
    var nuspecXMLObj:any;
    var nuspecDependenciesNode:any;
    var success:boolean = true;

    var projectPackageReferences:dep.dependency[] = new Array();
    try
    {
        projectFileData = await fileData.OpenFile(projectFileName);
        projectXMLObj = await GetXMLFileData(projectFileData);
        projectPackageReferences = ProcessProjectXMLFile(projectXMLObj);
    }
    catch(err)
    {
        success = false;
        tl.error("Could not successfully process the Project file");
        tl.error(err);
    }

    
    

    tl.debug("found " + projectPackageReferences.length.toString() + " package reference(s)");
    var updatedNuspec:any;
    try 
    {
        if(projectPackageReferences.length > 0)
        {
            var nuspecFileData:string = await fileData.OpenFile(nuspecFileName);
            var nuspecXMLObj:any = await GetXMLFileData(nuspecFileData);
            updatedNuspec =  ProcessNuspecData(nuspecXMLObj, projectPackageReferences);
        }    
    }
    catch(err)
    {
        success= false;
        tl.error("Could not successfully process the Nuspec data");
        tl.error(err);
    }
 

    if(success)
    {
        var fileOutput:string = nuspecFileName;
        if(!overwriteExistingFile)
        {
            fileOutput = "testoutput.nuspec";
        }
        fileData.WriteFile(fileOutput, updatedNuspec);
        tl.debug("Nuspec file Udpate written");
        
    }
    else
    {
        tl.setResult(tl.TaskResult.Failed, "Processing failed, not writing NuSpec file");
    }

    
}



//ProcessProjectXMLFile -- the goal is to extract all of the Pacakge Reference dependencies from this project to use to keep the Nuspec up to date
function ProcessProjectXMLFile(projectXMLObj: any):dep.dependency[] 
{
    var dependencies:dep.dependency[] = new Array();

    tl.debug("Processing Project File for Item Groups and PacakgeReferences");
    if (projectXMLObj.documentElement != null)
    {
        if(projectXMLObj.documentElement.hasChildNodes("ItemGroup"))
        {
            var projectItemGroups:any = projectXMLObj.documentElement.getElementsByTagName("ItemGroup");
            tl.debug("There were ItemGroups found: " + projectItemGroups.length.toString());

            for(var ndx:number = 0; ndx < projectItemGroups.length; ndx++)
            {
                var thisItemGroup:any = projectItemGroups[ndx];
                dependencies = dependencies.concat(getDependencyFromItemGroup(thisItemGroup));
            }

        }
        else
        {
            tl.debug("Project File does not contain any ItemGroup elements");
        }
    }
    else
    {
        tl.error("Project XML has no root documentElement");
    }

    return dependencies;
}



//getDependencyFromItemGroup -- The Project file PacakgeReference elements live inside the ItemGroup elements, we will process through
//              the ItemGroup elements to extract those PackageReferences and gather the information we need to put in the Nuspec
function getDependencyFromItemGroup(itemgroupElement:any):dep.dependency[]
{
    var groupDependencies:dep.dependency[] = new Array();
    
    if(itemgroupElement.hasChildNodes("PackageReference"))
    {
        var packagReferenceElements:any = itemgroupElement.getElementsByTagName("PackageReference");
        for(var ndx:number = 0; ndx < packagReferenceElements.length; ndx++)
        {
            var thisPkgRef:any = packagReferenceElements[ndx];
            if(thisPkgRef.hasAttribute("Include") && thisPkgRef.hasAttribute("Version"))
            {
                var thisDependency:dep.dependency = new dep.dependency(thisPkgRef.getAttribute("Include"),thisPkgRef.getAttribute("Version") );
                groupDependencies.push(thisDependency);

            }
            else if(thisPkgRef.hasAttribute("Include") && thisPkgRef.getElementsByTagName("Version"))
            {
                var thisDependency:dep.dependency = new dep.dependency(thisPkgRef.getAttribute("Include"),thisPkgRef.getElementsByTagName("Version")[0].firstChild.nodeValue);
                groupDependencies.push(thisDependency);
            }
            
        }
    }


    return groupDependencies;

}


function ProcessNuspecData(nuspecXMLObj:any, projectDependencies:dep.dependency[]):any
{
    if(nuspecXMLObj.documentElement != null)
    {
        if(nuspecXMLObj.documentElement.getElementsByTagName("metadata").length > 0)
        {
            
            var nuspecMetadataElement:any = nuspecXMLObj.documentElement.getElementsByTagName("metadata");
            if(nuspecMetadataElement[0].getElementsByTagName("dependencies").length > 0)
            {
                tl.debug("The nuspec currently has a dependencies node, we will clear it out to place project dependencies in");
                var dependenciesElement:any = nuspecMetadataElement[0].getElementsByTagName("dependencies");

                while(dependenciesElement[0].hasChildNodes())
                {
                    dependenciesElement[0].removeChild(dependenciesElement[0].firstChild);
                }

                
                //for(var depNdx:number = dependenciesElement[0].getElementsByTagName("dependency").length; depNdx > 0; depNdx--)                
                //{                    
                //    dependenciesElement[0].removeChild(dependenciesElement[0].getElementsByTagName("dependency")[depNdx-1]);
                //}
                tl.debug(dependenciesElement.toString());

            }
            else
            {
                tl.debug("the nuspec does not have a dependencies node, will create one to place project dependencies in");
                var dependenciesElement:any = nuspecXMLObj.createElement("dependencies");
                nuspecMetadataElement[0].appendChild(dependenciesElement);

            }

            projectDependencies.forEach(function(thisPR)
            {
                var dependenciesElement:any = nuspecMetadataElement[0].getElementsByTagName("dependencies");
                var depElement:any = nuspecXMLObj.createElement("dependency");                
                depElement.setAttribute("id",thisPR.id);
                depElement.setAttribute("version", thisPR.version);
                dependenciesElement[0].appendChild(depElement);
            });
        }
        else
        {
            tl.debug("The nuspec file had no metadata node, so no dependencies nodes are possible");
        }



    }
    else
    {
        tl.error("The nuspec file has no root element");
    }

    tl.debug("nuspecXML Now: " + nuspecXMLObj.toString());
    return nuspecXMLObj;
}



    ///Run function to handle the async running process of the task
async function Run()
{
    console.log("Reading JSON file to generate variables for future tasks... ");
    validateInputs();

    var fileContent:string = "";
    try{

        if(validInputs)
        {

            await DoWork(input_projectFile, input_nuspecFile, true);
           // var contentObj:any = await getFileJSONData();
           // var result:boolean =  await processJson.ProcessKeys(contentObj, input_variablePrefix, input_shouldPrefixVariables);
        
        }
        else{
            tl.setResult(tl.TaskResult.Failed, "Invalid Inputs");
        }
    }
    catch(err)
    {
        tl.error(err);
        
        tl.setResult(tl.TaskResult.Failed, "Processing dependencies for Nuspec failed");
    }
}
