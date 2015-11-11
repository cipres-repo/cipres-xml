$(document).ready(function() {
	console.log("here I am");
	//cipres tool API url
	var tool_url = 'https://bumper.sdsc.edu/cipresrest/v1/tool';
	//retrieve tools xml
	$.ajax({
		url: tool_url,
		type: 'GET',
		dataType: 'xml'
	})
	//render dropdown
	.then(function(data){
		var list = "<select id='toolselector'>";
		//iterate through tools
		$(data).find("tool").each(function(index, value) {
			//retrieve tool name and url to pise xml
			var $node = $(value);
			var toolName = $node.find('toolId').text();
			var pise = $node.find('piseUri').find('url').text();
			//create dropdown option
			list += "<option value='" + pise + "'>" + toolName + "</option>";
		});
		list += "</select><br>";
		//append to tools div
		$('.tools').append(list);


		//render new tool on value change
		$("#toolselector").change(function() {

			pise_tool.render_tool($(this).val(), ".container", theCallback);

			//add source file option to form
			$(".container form").prepend("<label>Input source:</label>" + 
				"<select name=source><option>Kepler director</option><option>web upload</option></select><br>");
		});
	});
});


/*
	We expect the caller to provide the callback fn when calling pise_tool.render_tool.
	A javascript app should be able to do that by setting theCallback variable after
	including this file (TODO: test this).  Desktop-cipres, an example java desktop
	app, setts theCallback to a java method.  The two parameters i and v are dictionaries
	of the input and vparam fields expected by the rest api.  We pass them
	as json strings so that they can be easily accessed in java as well as javascript.
*/
var theCallback = defaultCallback;

function defaultCallback(i, v)
{
	var iparams = $.parseJSON(i);
	var vparams = $.parseJSON(v);

	console.log("form submitted.")
	console.log("IPARAMS:");
	var key;
	for (key in iparams)
	{
		if (iparams.hasOwnProperty(key))
		{
			console.log(key + "=" + iparams[key]);
		}
	}
	console.log("VPARAMS:");
	for (key in vparams)
	{
		if (vparams.hasOwnProperty(key))
		{
			console.log(key + "=" + vparams[key]);
		}
	}
}


/*
	There are several different use cases where we want to handle pise InFile and Sequence data types in different ways.
	I'm not sure what a good general purpose solution will look like yet.
	
	Initially pise-tool was always rendering InFile and Sequence with <input type="file">.   Javascript can't reliably get the
	full pathname of the file or read the file to build a rest api submission.

	The first use case I'm addressing here is that of a desktop application where we want to use a java FileChooser
	dialog.  For the time being, I'm indicating that by setting fileChooserType=desktop.   See desktop-cipres
	application, which overrides the values of fileChooserType and theFileChooser. 
*/
var fileChooserType = "default";
var theFileChooser = defaultFileChooser;

function defaultFileChooser()
{
	console.log("returning foo.txt");
	return "foo.txt";
}
