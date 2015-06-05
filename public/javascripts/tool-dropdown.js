$(document).ready(function() {
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
			pise_tool.render_tool($(this).val(), ".container", function(data) {
				console.log("form submitted.")
				console.log(data);
			});
			//add source file option to form
			$(".container form").prepend("<label>Input source:</label>" + 
				"<select name=source><option>Kepler director</option><option>web upload</option></select><br>");
			//add headings to simple and advanced containers
			$("div.simple").prepend("<h2>Simple Params</h2>");
			$("div.advanced").prepend("<h2>Advanced Params</h2>");
		});
	});
});