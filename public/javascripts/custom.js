$(document).ready(function() {
	var url = 'https://bumper.sdsc.edu/cipresrest/v1/tool/CLUSTALW/doc/pise';
	$.ajax({
		url: url,
		type: 'GET',
    dataType: 'xml'
	}).then(function(data) {
		console.log(data);
	});
});