import * as run from '../taskRun';
import * as getFSData from '../getFSData';


//run.DoWork('./NuspecUpdate/src/test/NugetSampleTest.csproj','./NuspecUpdate/src/test/NugetSampleTest.nuspec',false);
run.DoWork('./NuspecUpdate/src/test/NugetSampleTestNoRef.csproj','./NuspecUpdate/src/test/NugetSampleTestNoRef.nuspec',false);