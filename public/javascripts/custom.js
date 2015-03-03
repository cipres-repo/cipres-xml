$(document).ready(function() {
	//configuration
	var url = 'https://bumper.sdsc.edu/cipresrest/v1/tool/BEAST_TG/doc/pise';
	
	//subject -> observer(s)
	var observerMap = {};
	//array of controls
	var controlsArray = [];

	//retrieve pisexml file
	$.ajax({
		url: url,
		type: 'GET',
    dataType: 'xml'
	})
	//render file
	.then(function(data) {
		//iterate through parameters
		$(data).find("parameter[issimple='1']:not([ishidden='1'])").each(function(index, value) {
			//default parameters for insertElement
			var $node = $(value);
			var label = $node.find('prompt').text();
			var disabled = false;
			var data = null;

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
				//adjust parameters
				disabled = true;
				data = {
					code: code,
					subjects: subjects.join()
				};
			}
			//node has controls
			var $controls = $node.find('ctrl');
			if ($controls.length) {
				$.each($controls, function(index, value) {
					var $value = $(value);
					//push control and its relevant properties to controlsArray
					controlsArray.push({
						message: $value.children('message').text(),
						code: $value.children('code').text(),
					});
				});
			}
			//append element to html DOM
			insertElement($node, label, disabled, data);
		});
		//bind subjects in observermap to observers
		for (var prop in observerMap) {
			var selector = '#' + prop.substr(1);
			console.log(selector);
			$(selector).data('obs', observerMap[prop].toString()).change(notifyObservers);
		}
		//append submit button
		$('form').append('<input type="submit" value="Test Submit">');
	});

	//Form submition
	$('form').submit(function(e) {
		e.preventDefault();
		var error = false;
		//evaluate the controls
		$.each(controlsArray, function(index, value) {
			if (resolveControl(value)) {
				alert(value.message);
				error = true;
				return false;
			}
		});
		//submit if there were no errors
		if (!error) {
			alert('no errors recorded');
		}
	});

	/// HELPER FUNCTIONS ///

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
		$value.prop('disabled', !resolve(code, subjects));
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
		console.log(code);
		console.log(subjects);
		//evaluate and reeturn
		return(eval(code));
	}

	function resolveControl(control) {
		var variables = control.code.match(/\$\w+/g);
		return(resolve(control.code, variables));
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