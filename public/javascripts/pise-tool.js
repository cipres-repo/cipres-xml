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
					var $value = $(value);
					//paragraph parameters
					if($value.attr('type') == 'Paragraph') {
						var id = $value.children('paragraph').children('name').text();
						//insert paragraph
						insertToForm(value, observerMap, controlsArray, containers, true);
						//insert paragraph elements
						$value.children('paragraph').children('parameters').children(paramFilter).each(function(index, value) {
							insertToForm(value, observerMap, controlsArray, {
								simContainer: "div#" + id + " > div.simple",
								advContainer: "div#" + id + " > div.advanced"
							}, false);
						});
					}
					//other parameters
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
		//finished generating input elements

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
	//end of toolObj.render_tool

	/// HELPER FUNCTIONS ///

	//inserts individual parameters to form
	/*
		value: xml parameter
		paragraph: element is a paragraph parameter (boolean)
	*/
	function insertToForm(value, observerMap, controlsArray, containers, paragraph) {
		//default parameters for insertElement
		var $node = $(value);
		var label;
		if (paragraph) {
			$node = $node.children('paragraph');
			$node.attr('type', 'Paragraph');
			label = $node.children('prompt').text();
		}
		else {
			label = $node.children('attributes').children('prompt').text();
		}
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
	//end of function: insertToForm

	//use this function to replace invalid perl code
	function sanitizeCode(code) {
		return code
			.replace(/!defined */g, '!')
			.replace(/\bne\b/g, '!=')
			.replace(/\beq\b/g, '==')
			.replace(/"/g, "'")
			//replace regex testing operator
			.replace(/ *=~ */g, '.search')
			.replace(/\//g, 'PLACEHOLDER')
			.replace(/.searchPLACEHOLDER/g, '.search(/')
			.replace(/PLACEHOLDER/g, '/) > -1');
			;
	}
	//end of function: sanitizeCode

	//notifies all observers of value change
	function notifyObservers() {
		var observers = $(this).data('obs').split(',');
		$.each(observers, notify);
	}
	//end of function: notifyObservers

	//notifies single observer
	function notify(index, value) {
		$value = $('#' + value);
		var subjects = $value.data('sub').split(',');
		var code = $value.data('code');
		//modify child elements if paragraph
		if ($value.hasClass('paragraph')) {
			$value.children().prop('disabled', !resolve(code, subjects));
		}
		else
			$value.prop('disabled', !resolve(code, subjects));
	}
	//end of function: notify

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
		//evaluate and return
		return(eval(code));
	}
	//end of function: resolve

	//resolves a control
	function resolveControl(control) {
		var variables = control.code.match(/\$\w+/g);
		return(resolve(control.code, variables));
	}
	//end of function: resolveControl

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
		//parameter is a dropdown
		var vlist = false;
		//parameter is a paragraph
		var para = false;
		//assign appropriate input type based on parameter type
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
				type = 'type="text" ';
		}
		//determine element values
		var name= 'name="' + $node.children('name').text() + '" '
		var id = 'id="' + $node.children('name').text() + '" ';
		var disabled = (options.disabled) ? 'disabled' : '';
		var data = (options.data) ? 'data-sub="' + options.data.subjects + '" data-code="' + options.data.code + '" ' : '';

		var eString = null;
		//generate paragraph
		if (para) {
			eString = "<div " + name + id + data + disabled + "class='paragraph'>";
			eString += "<div class='simple'></div><div class='advanced'></div>";
			eString += "</div>";
		}
		//generate dropdown
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
		//generate input
		else {
			eString = "<input " + name + id + type + data + disabled  + "><br>";
		}
		var text;
		//create label or heading
		if (para) {
			text = "<h4>" + options.label + "</h4>";
		}
		else {
			text = "<label>" + options.label + "</label>";
		}
		//and append elements to specified container
		$(options.container).append("<div class='form-group'>" + text + eString + "</div>");
	}
	//end of function: insertElement

	return toolObj;

})();