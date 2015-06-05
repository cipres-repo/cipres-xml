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
		//parameter filter
		var paramFilter = "parameter:not([ishidden='1']):not([type='Results']):not([type='OutFile'])";

		//create form element
		$(container)
			.append("<form></form>")
			.children('form')
			//append simple and advanced containers
			.append("<div class='simple'></div><div class='advanced'></div>");
		container = container + " form";

		//container reference
		var containers = {
			simContainer: container + " > div.simple",
			advContainer: container + " > div.advanced"
		};

		//retrieve pisexml file
		$.ajax({
			url: url,
			type: 'GET',
	    dataType: 'xml'
		})
		//generate input elements
		.then(function(data) {
			//iterate through parameters
			$(data)
				.children()
				.children("parameters")
				.children(paramFilter).each(function(index, value) {
					if($(value).attr('type') == 'Paragraph') {
						var id = $(value).children('paragraph').children('name').text();
						insertToForm(value, observerMap, controlsArray, containers, true);
						//var children = $(value).children('paragraph').children('parameters').children("parameter:not([ishidden='1']):not([type='Results']):not([type='OutFile'])");
						$(value).children('paragraph').children('parameters').children(paramFilter).each(function(index, value) {
							insertToForm(value, observerMap, controlsArray, {
								simContainer: "div#" + id + " div.simple",
								advContainer: "div#" + id + " div.advanced"
							}, false);
						});
					}
					else {
						insertToForm(value, observerMap, controlsArray, containers, false);
					}
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
	function insertToForm(value, observerMap, controlsArray, containers, paragraph) {
		//default parameters for insertElement
		var $node = $(value);
		if (paragraph) {
			$node = $node.children('paragraph');
		}
		var label = $node.children('attributes').children('prompt').text();
		var disabled = false;
		var data = null;

		var $precond = $node.children('attributes').children('precond');
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
				code: sanitizeCode(code),
				subjects: subjects.join()
			};
		}
		//node has controls
		var $controls = $node.children('attributes').children('ctrls').children('ctrl');
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
		insertElement($node, {
			label: label, 
			disabled: disabled,
			data: data,
			container: ($node.attr('issimple') == 1) ? containers.simContainer : containers.advContainer
		});		
	}
	//use this function to replace invalid perl code
	function sanitizeCode(code) {
		return code
			.replace(/!defined */g, '!')
			.replace(/\bne\b/g, '!=')
			.replace(/\beq\b/g, '==')
			.replace(/"/g, "'");
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
		if ($value.hasClass('paragraph')) {
			$value.children().prop('disabled', !resolve(code, subjects));
		}
		else
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
	/*
		options:
		label: label for the element
		disabled: true -> element is disabled
		data: observer data
		container: css selector, containing element
	*/
	function insertElement($node, options) {
		var type = $node.attr('type');
		var vlist = false;
		var para = false;
		//assign appropriate input type
		switch (type) {
			case 'Integer':
				type = 'type="text" ';
				break;
			case 'Float':
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
			case 'List':
				vlist = true;
				break;
			case 'Sequence':
				type = 'type="file" ';
				break;
			case 'InFile':
				type = 'type="file" ';
				break;
			case 'Paragraph':
				para = true;
				break;
			default: 
				para = true;
		}

		var name= 'name="' + $node.children('name').text() + '" '
		var id = 'id="' + $node.children('name').text() + '" ';
		var disabled = (options.disabled) ? 'disabled' : '';
		var data = (options.data) ? 'data-sub="' + options.data.subjects + '" data-code="' + options.data.code + '" ' : '';

		var eString = null;
		if (para) {
			eString = "<div " + name + id + data + disabled + "class='paragraph'>";
			eString += "<div class='simple'></div><div class='advanced'></div>";
			eString += "</div>";
		}
		else if (vlist) {
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

		var label = "<label>" + options.label + "</label>";
		$(options.container).append("<div class='form-group'>" + label + eString + "</div>");
	}
	return toolObj;
})();