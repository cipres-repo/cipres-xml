$(document).ready(function() {
	
	var url = 'https://bumper.sdsc.edu/cipresrest/v1/tool/BEAST_TG/doc/pise';
	
	$.ajax({
		url: url,
		type: 'GET',
    dataType: 'xml'
	})

	.then(function(data) {
		//subject -> observer(s)
		var observerMap = {};
		//iterate through parameters
		$(data).find("parameter[issimple='1']:not([ishidden='1'])").each(function(index, value) {
			var $node = $(value);
			var label = $node.find('prompt').text();
			var $precond = $node.find('precond');
			//node has precondition, add to observer map
			if ($precond.length) {
				var observer = $node.children('name').text();
				var code = $precond.children('code').text();
				//find all variables beginning with $
				var subjects = code.match(/\$\w+/g);
				//populate observer map
				$.each(subjects, function(index, value) {
					if ( observerMap[value] ) {
						observerMap[value].push(observer);
					}
					else {
						observerMap[value] = [observer];
					}
				});

				insertElement($node, label, true, {code: code, subjects: subjects.join()});
			}
			else {
				insertElement($node, label, false, null);
			}

		});
		//bind subjects in observermap to observers
		for (var prop in observerMap) {
			var selector = '#' + prop.substr(1);
			console.log(selector);
			$(selector).data('obs', observerMap[prop].toString()).change(notifyObservers);
		}

	});
	//notifies observers of value change
	function notifyObservers() {
		var observers = $(this).data('obs').split(',');
		$.each(observers, notify);
		console.log('observers notified');
	}

	function notify(index, value) {
		$value = $('#' + value);
		var subjects = $value.data('sub').split(',');
		var code = $value.data('code');
		$value.prop('disabled', resolve(code, subjects));
	}

	function resolve(code, subjects) {
		$.each(subjects, function(index, value) {
			//replace variables in code with reference to subjects array
			code = code.replace(value, 'subjects[' + index + ']');
			//replace values in subjects array
			$subject = $('#' + value.substr(1));
			if ($subject.attr('type') == 'checkbox') {
				subjects[index] = $subject.prop('checked');
			}
			else {
				subjects[index] = $subject.val();
			}
		});
		//evaluate and reeturn
		return(!eval(code));
	}

	//nserts xml element into dom
	function insertElement($node, label, disabled, data) {
		var type = $node.attr('type');
		//assign appropriate input type
		switch (type) {
			case 'Integer':
				type = 'type="text"';
				break;
			case 'String':
				type = 'type="text"';
				break;
			case 'Switch':
				type = 'type="checkbox"';
				break;
			default: 
				type = 'type="text"';
		}
		var id = 'id="' + $node.children('name').text() + '"';
		var disabled = (disabled) ? 'disabled' : '';
		var data = (data) ? 'data-sub="' + data.subjects + '" data-code="' + data.code + '"' : '';

		var eString = "<input " + id + type + data + disabled  + "><br>";
		
		label = "<label>" + label + "</label>";
		$('.output').append(label + eString);

	}

});