var pise_tool = (function() {
	var toolObj = {};
	//observer map and controls array
	var observerMap = null;
	var controlsArray = null;
	//expose tool-rendering function
	/*
		tool-rendering function
		url: pise url of tool
		container: css selector (string) for html container
		callback: function to be executed with 
	*/
	toolObj.render_tool = function(url, container, callback) {
		//empty container
		$(container).empty();
		//subject -> observer(s)
		observerMap = {};
		//array of controls
		controlsArray = [];

		//create form element
		$(container).append("<form></form>");
		container = container + " form";

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
							code: sanitizeCode($value.children('code').text()),
						});
					});
				}
				//append element to html form
				insertElement($node, label, disabled, data, container);
			});
			//bind subjects in observermap to observers
			for (var prop in observerMap) {
				var selector = '#' + prop.substr(1);
				$(selector).data('obs', observerMap[prop].toString())
					//notify observers on status change
					.change(notifyObservers)
					//initial notiiication to observers
					.trigger('change');
			}
			//append submit button
			$(container).append('<input type="submit" value="submit">');
		});

		//Form submission
		$(container).unbind().submit(function(e) {
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
			//execute callback if no errors
			if (!error) {
				callback($(this).serializeArray());
			}
		});
	};

	/// HELPER FUNCTIONS ///
	//use this function to replace invalid perl code
	function sanitizeCode(code) {
		return code.replace(/!defined */, '!');
	}
	//notifies all observers of value change
	function notifyObservers() {
		var observers = $(this).data('obs').split(',');
		$.each(observers, notify);
		console.log('observers notified');
	}
	//notifies single observer
	function notify(index, value) {
		$value = $('#' + value);
		var subjects = $value.data('sub').split(',');
		var code = $value.data('code');
		$value.prop('disabled', !resolve(code, subjects));
	}
	//resolve observer-subject dependency
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
		return(eval(code));
	}

	function resolveControl(control) {
		var variables = control.code.match(/\$\w+/g);
		return(resolve(control.code, variables));
	}

	//appends element to form
	function insertElement($node, label, disabled, data, container) {
		var type = $node.attr('type');
		var vlist = false;
		//assign appropriate input type
		switch (type) {
			case 'Integer':
				type = 'type="text" ';
				break;
			case 'String':
				type = 'type="text" ';
				break;
			case 'Switch':
				type = 'type="checkbox" ';
				break;
			case 'Excl':
				vlist = true;
				break;
			default: 
				type = 'type="text" ';
		}
		var name= 'name=' + $node.children('name').text() + '" '
		var id = 'id="' + $node.children('name').text() + '" ';
		var disabled = (disabled) ? 'disabled' : '';
		var data = (data) ? 'data-sub="' + data.subjects + '" data-code="' + data.code + '" ' : '';

		var eString = null;
		if (vlist) {
			//select element
			eString = "<select " + name + id + data + disabled + ">";
			//options

			$.each($node.find('vlist').children('value'), function(index, value) {
				var $val = $(value);
				eString += "<option value='" + $val.text() + "'>" + $val.next().text() + "</option>";
			});
			//end select element
			eString += "</select><br>";
		}
		else {
			eString = "<input " + name + id + type + data + disabled  + "><br>";
		}

		label = "<label>" + label + "</label>";
		$(container).append(label + eString);

	}

	return toolObj;
})();