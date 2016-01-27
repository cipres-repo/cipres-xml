$(document).ready(function() 
{
	console.log("document is ready, calling pise_tool.init(null,null,null)");
	pise_tool.init(null, null, null);
	console.log("calling pise_tool.chooseTool");
	pise_tool.chooseTool('https://bumper.sdsc.edu/cipresrest/v1/tool', "#cipres_tools", "#cipres_form");
});

