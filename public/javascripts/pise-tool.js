/*
	TODO: I don't think vdefs are being used.
	Basic data types (int, float) aren't being validated.
		I think this needs to be done before preconds are eval'd so we don't try to
		compare strings and ints.
	
*/
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

			/* 
				TODO: also validate required fields present
				should find and report all errors at once.

				Validate controls on empty string is not working the same as on portal.
			*/

			$(container).find('input').each(function()
			{
				var type = $(this).data('type');
				var id = $(this).attr('id');
				var value = $(this).val();
				//if (type && (type == 'Integer'))
				if (type && (type == 'Integer'))
				{
					if ( ! /^(0|[1-9]\d*)$/.test(str) )
					{
						console.log("field with id=" + id + " is not an integer");
						alert(id + " must be a positive integer.");
						return false;
					}
						
				} else if (type && (type == 'Float'))
				{
					if ( ! /^\s*(\+|-)?((\d+(\.\d+)?)|(\.\d+))\s*$/.test(value) )
					{
						console.log("field with id=" + id + " is not float");
						alert(id + " must be a decimal number.");
						return false;
					}
				} 
				
			});


			//evaluate the controls
			$.each(controlsArray, function(index, value) {
				if (resolveControl(value)) 
				{
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
			.replace(/defined */g, ' ')
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

	/*
		evaluate perl code snippets that have been  converted to javascript
		variables is an array of the parameter names that are used as variables in the code snippet.
		Used for pise precond and ctrl elements.
	*/
	function resolve(code, variables) {
		console.log("Initial code: " + code);
		console.log("Initial variables: " + variables);

		/*
			replace variables in code with reference to variables array
			and then replace elements of variables array with their values
			So code starts out looking like: ($p1 > $p2) and we change this to: ($variables[0] > $variables[1])
			variables[] on entry to this fn looks like: ["$p1", "$p2"] and we change it to something like: [3, 5]
		*/
		$.each(variables, function(index, varname) {
			code = code.replace(varname, 'variables[' + index + ']');
			$field = $('#' + varname.substr(1));
			if ($field.attr('type') == 'checkbox') {
				variables[index] = $field.prop('checked');
			}
			else {
				variables[index] = $field.val();
			}
		});
		console.log("code: " + code);
		console.log("variables: " + variables);
		try
		{
			var retval = eval(code);
			console.log("Result is: " + retval + " .Which is " + retval ? "true" : "false");
			return (retval);
		}
		catch (e)
		{
			// This means the pise code snippet or our handling of it needs to be fixed.
			console.log("Error evaluating: " + code);
			console.log(e.message);
			alert("Error evaluating: " + code + ".  Error is: " + e.message);
			return 0;
		}
		return(eval(code));
	}
	//end of function: resolve

	//resolves a control
	function resolveControl(control) 
	{
		console.log("resolveControl" );
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
	function insertElement($node, options) 
	{
		var paramType = $node.attr('type');
		//parameter is a dropdown
		var vlist = false;
		//parameter is a paragraph
		var para = false;
		//assign appropriate input type based on parameter type
		switch (paramType) {
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
		var elementID = $node.children('name').text();
		var name= 'name="' + elementID +  '" '
		var id = 'id="' + elementID + '" ';
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

		// Store type with each element.
		var element = $('#' + elementID);
		element.data('type', paramType);
	}
	//end of function: insertElement

	return toolObj;

})();
