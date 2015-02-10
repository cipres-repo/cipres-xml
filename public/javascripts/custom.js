$(document).ready(function() {
	var url = 'https://bumper.sdsc.edu/cipresrest/v1/tool/CLUSTALW/doc/pise';
	$.ajax({
		url: url,
		type: 'GET',
    dataType: 'xml'
	}).then(function(data) {
		//console.log(data);
		var count = 0;
		var parameters = $(data).find("parameter").each(function(index, value) {
			var string = "<tr>"
			string += "<td>" + $(this).find("name").text() + "</td>";
			string += "<td>" + $(this).find("prompt").text() + "</td>";
			string += "<td>" + $(this).attr("type") + "</td>";
			string += "</tr>";
			$('table').append(string);
			count++;
		});
		//console.log(parameters);
		console.log(count);
	});
});