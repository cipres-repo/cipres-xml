/*
	TODO: 
		- How does the portal initialze Lists and Excls that don't have vdefs?

		- Set maxlength for input fields.  In portal it's 600.

		- Add help text (as hover?  also as a link.)  An element's label should be an href link to 
		its help text and the help text should have a link back to the element. 

		- Validation on submit:
			- validate that required fields are all present and not disabled.
			- need to validate pise min/max when they appear for Integer and Float types.
			- should we find and report all errors at once, rather than one at a time? 
			- Or if reporting a single error, return focus to the element that caused the error.

		- "Submitting" the form.  See comments at serialzeArray().  It isn't exactly what we
		need to do.

		- In insertElement() I corrected handling of "List" pise type.  It should be a multiple select
		control.  It is correct now but looks terrible.  Fix appearance?  To see it in action, choose
		tool = muscle and scroll down to "Diagonal Functions".

		- Paragraphs:
			- Can paragraphs have preconds that affect all params in the paragraph?
			- I don't think we need simple and advanced divs within paragraphs.  I think the only issimple we
			need to pay attention to would be one on the top level parameter enclosing the parapgraph.  In other
			words, the whole paragraph is either in the simple or advanced section.

		- Excl type: when there are less than 4 choices (check on this, it may be less than 3) it is done
		as a radio button in cipres.  For example, see probalign "Sequence Type" in the portal.  If we
		do the same here, note that special handling may be required to disable/enable and get the value
		of radio button controls.

		- I want to set an attribute on the whole form-group that includes the label and the
		input/select element, when the element is disabled.  That way we can do different css styling 
		(in a stylesheet) for enabled/disabled field groups.  In particular I'd like to try changing the 
		label text to light gray when disabled.  It's too hard for me to see which fields are disabled.

		- Simple and Advanced headers should collapse and expand their sections.  Initially Simple is expanded 
		and Advanced is collapsed.  Same as in the portal.


	Cheatsheet for Terri:
		- $ is an alias for jQuery in many contexts.  For example $(container) means jQuery(container).
		- javascript lets you use '$' in variable names.  It's a jquery convention to have var name
			start with $ when it refers to a jquery object.  For example: $field = $(#field_id)
		- There are lots of ways to select jQuery objects:
			$("#name") = element with id = "name"
			$(".foo") = elements with class "foo"
			$("p") = all <p> elements
		- all jquery objects (form fields, divs, etc) have a data(name, value) method that 
		lets you associate arbitrary data with the object.  Attributes in the html of the form "data-X=y"
		can be retrieved with .data('X').
		- jQuery supports "fluent" or "chained" method calls where most methods return
		the object they were called on.
		- Can't use continue and break in JQuery each loop.  You need to return true (continue) or false (break)
		from the function instead.
		- empty string is false.
		- The css id of each element in the form is the same as the name of the corresponding pise parameter.
*/
var pise_tool = (function() {
	var toolObj = {};
	var formSelector;


	/*
		tool-rendering function
		url: pise url of tool
		container: css selector (string) for html container that is to contain the form
		callback: function to be executed with 
	*/
	toolObj.render_tool = function(url, container, callback) 
	{
		$(container).empty();	
		var paramFilter = "parameter:not([ishidden='1']):not([type='Results']):not([type='OutFile'])";

		//create form element
		$(container).append("<form></form>").children('form').
			append("<div class='simple'></div><div class='advanced'></div>");

		// Set container to css selector for the form 
		container = container + " form";
		formSelector = container;

		// selectors for the simple and advanced divs.  E.g. $(containers.simContainer) is the simple container.
		var containers = {
			simContainer: container + " > div.simple",
			advContainer: container + " > div.advanced"
		};

		//retrieve pisexml file.  Callback fn creates form elements from pisexml parameters.
		$.ajax({ url: url, type: 'GET', dataType: 'xml' }).then(function(data) 
		{
			//iterate through parameters
			$(data)
				.children()
				.children("parameters")
				.children(paramFilter).each(function(index, value) 
				{
					var $value = $(value);
					if($value.attr('type') == 'Paragraph') 
					{
						var id = $value.children('paragraph').children('name').text();
						insertToForm(value, containers, true);
						$value.children('paragraph').children('parameters').children(paramFilter).each(function(index, value) 
						{
							insertToForm(
								value, 
								{
									simContainer: "div#" + id + " > div.simple",
									advContainer: "div#" + id + " > div.advanced"
								}, 
								false);
						});
					}
					else {
						insertToForm(value, containers, false);
					}
			});
			//append submit button
			$(container).append('<input type="submit" value="submit">');

			// Enable/disable elements based on their preconds.
			resolveParameters(null);
		});

		// Define what happens when form is submitted.
		$(container).unbind().submit(function(e) 
		{
			e.preventDefault();
			var error = false;
			/* 
				Validate datatype for 'Integer' and 'Float' parameters.  This is why we have data('pisetype') stored
				with each input element.  
			*/
			$(container).find('input').each(function()
			{
				var type = $(this).data('pisetype');
				var id = $(this).attr('id');
				var value = $(this).val();
				//if (type && (type == 'Integer'))
				if (type && (type == 'Integer'))
				{
					if ( value && ! /^(0|[1-9]\d*)$/.test(value) )
					{
						console.log("field with id=" + id + " is not an integer");
						alert(id + " must be a positive integer.");
						error = true;
						//return false;
					}
						
				} else if (type && (type == 'Float'))
				{
					if ( value && ! /^\s*(\+|-)?((\d+(\.\d+)?)|(\.\d+))\s*$/.test(value) )
					{
						console.log("field with id=" + id + " is not float");
						alert(id + " must be a decimal number.");
						error = true;
						//return false;
					}
				} 
				
			});

			// iterate over all form elements that have controls 
			var elementsWithCtrls= $('*').filter(function() { return $(this).data('ctrls') !== undefined; });
			$.each(elementsWithCtrls, function() 
			{
				if (!isDisabled($(this).attr('id')))
				{
					var ctrls = $(this).data('ctrls');
					var i;
					for (i = 0; i < ctrls.length; i++)
					{
						var code = ctrls[i].code;
						var message = ctrls[i].message;
						if (resolveCode($(this), code))
						{
							console.log(message);
							alert(message);
							error = true;
							//return false;
						}
					}
				}
			});

			/*
				execute callback if no errors.  Ideally I think we'd collect and report all errors at once, though only 
				one error per each field.  For instance if runtime="foo", you wouldn't want to report 
				"runtime must be a number" and "runtime must be > .1"
			*/
			if (!error) 
			{
				/*
					Build list of vparams and iparams that the rest api will need.
				*/
				var vparams = {};
				var iparams = {};
				$(container).find('input, select').each(function()
				{
					var id = $(this).attr('id');
					if (!isDisabled(id)) 
					{
						var value = $(this).val();
						if (value == '')
						{
							return;
						}
						var type = $(this).data('pisetype');
						if (type == 'InFile' || type == 'Sequence')
						{
							iparams[id] = value;
						} else
						{
							vparams[id] = value;
						}
					}
				});

				/*
					- serializeArray apparently omits select elements of type="file"!
					- It also omits anything that is disabled or has empty string as the value, as it would for a form submission.
					- The value, of a file control, is just the filename, no path info. Can we get the path info?
					- Only checked checkboxes are sent. TODO: We need to send value of all checkboxes that aren't disabled.
						In the cipres portal we use struts and struts has code to work around this so that the action
						that the form is posted to gets a boolean value for each checkbox.
				*/
				//callback($(this).serializeArray());
				callback(iparams, vparams);
			}
		});
	};
	//end of toolObj.render_tool


	/*
		inserts individual parameters to form
		value: xml parameter
		paragraph: boolean - is element is a paragraph parameter ? 

		if parameter  has precond, adds 'precond' to elements data
		if parameter has ctrls, adds 'ctrls' to elements data 
	*/
	function insertToForm(value, containers, paragraph) 
	{
		var $node = $(value);
		var label;
		var precondCode;
		var ctrl; 
		var data = null;

		if (paragraph) 
		{
			$node = $node.children('paragraph');
			$node.attr('type', 'Paragraph');
			label = $node.children('prompt').text();
		}
		else 
		{
			label = $node.children('attributes').children('prompt').text();
		}

		//append element to html form
		var element = insertElement($node, 
			{
				label: label, 
				container: ($node.attr('issimple') == 1) ? containers.simContainer : containers.advContainer
			});		

		/*
			Associate some data with the input element. Data has these keys:
				- 'precond'
				- 'ctrls' 
				- 'pisetype' (added by insertElement)
		*/
		// There is only one precond element per parameter, at most
		var $precond = $node.children('attributes').children('precond');
		if ($precond.length) 
		{
			precondCode = $precond.children('code').text();
			element.data('precond', sanitizeCode(precondCode));
		}

		//node can have multiple ctrl elements 
		var $controls = $node.children('attributes').children('ctrls').children('ctrl');
		if ($controls.length) 
		{
			ctrl = [];
			$.each($controls, function(index, value) 
			{
				var $value = $(value);
				ctrl.push({
					message: $value.children('message').text(),
					code: sanitizeCode($value.children('code').text())
				});
			});
			element.data('ctrls', ctrl);
		}
	}

	//convert perl code snippet to javascript
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
	}


	/*
		evaluate perl code snippets that have been  converted to javascript
		- the html element the code is associated with (for resolving "$value" in code string) 
		- code is the code to eval 
	*/
	function resolveCode(element, code) 
	{

		//	replace variables in code 
		var variables = code.match(/\$\w+/g);
		//console.log("resolveCode for element: " +  element.attr('id') + " , code: " + code);

		$.each(variables, function(index, varname) 
		{
			var id;
			var tmp;
			if (varname == "value")
			{
				id  = element.attr('id');

				// just for debugging
				//tmp = getValue(id);
			} else
			{
				id  = varname.substr(1);
				// just for debugging
				//tmp = getValue(id);
			}
			code = code.replace(varname, "getValue('" + id + "')");
		});
		//console.log("Modified code: " + code);
		try
		{
			var retval = eval(code);
			//console.log("Result is: " + retval);
			return retval;
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


	/*
		Appends an html element to the form.  The element's id comes from the name of the pise parameter.

		$node: pisexml parameter
		options:
			label: label for the element
			container: css selector of the containing element
	*/
	function insertElement($node, options) 
	{
		var paramType = $node.attr('type');
		var vlist = false;
		var multipleSelect = false;
		var para = false;
		var typeAttr;


		switch (paramType) {
			case 'Integer':
				typeAttr = 'type="text" ';
				break;
			case 'Float':
				typeAttr = 'type="text" ';
				break;
			case 'String':
				typeAttr = 'type="text" ';
				break;
			case 'Switch':
				typeAttr = 'type="checkbox" ';
				break;
			case 'Excl':
				vlist = true;
				break;
			case 'List':
				vlist = true;
				multipleSelect = true;
				break;
			case 'Sequence':
				typeAttr = 'type="file" ';
				break;
			case 'InFile':
				typeAttr = 'type="file" ';
				break;
			case 'Paragraph':
				para = true;
				break;
			default: 
				typeAttr = 'type="text" ';
		}
		//determine element values
		var elementID = $node.children('name').text();
		var name= 'name="' + elementID +  '" '
		var id = 'id="' + elementID + '" ';

		var eString = null;
		var text;

		// Insert divs and heading for a paragraph
		if (para) 
		{
			eString = "<div " + name + id + "class='paragraph'>";
			eString += "<div class='simple'></div><div class='advanced'></div>";
			eString += "</div>";
			text = "<h4>" + options.label + "</h4>";
			$(options.container).append("<div class='form-group'>" + text + eString + "</div>");
		} else
		{

			if (vlist) //generate select
			{
				//select element
				if (multipleSelect) 
				{
					eString = "<select multiple "
				} else
				{
					eString = "<select "
				}
				eString +=  ( name + id +   ">" );
				//options
				$.each($node.find('vlist').children('value'), function(index, value) {
					var $val = $(value);
					eString += "<option value='" + $val.text() + "'>" + $val.next().text() + "</option>";
				});
				eString += "</select><br>";
			} else //generate input
			{
				eString = "<input " + name + id + typeAttr +  "><br>";
			}
			text = "<label>" + options.label + "</label>";
			$(options.container).append("<div class='form-group'>" + text + eString + "</div>");
		}
		// Store pise datatype with each element.
		var element = $('#' + elementID);
		element.data('pisetype', paramType);

		// When any element changes, call resolveParameters
		element.change({source: elementID}, resolveParameters);

		//console.log("Getting default value of " + elementID);
		var defaultValue = getDefaultValue($node);
		//console.log("Default value is: " + defaultValue);

		// Set default value
		if (defaultValue != null)
		{
			if (paramType == "Switch")
			{
				element.prop('checked', defaultValue);
			} else
			{
				element.val(defaultValue);
			}
		}
		return element;
	}

	/*
		If pise xml parameter $node has a vdef element, returns its value.  
			- For "Lists" (but not "Excls") this will be an array of strings
			- For "Switch" it will be a boolean
			- Otherwise it's a string.
			- If no vdef element, returns null.

		- I believe Lists are the only pise parameters that can have multiple <value> 
		elements in a <vdef> element and there should be only one <vdef> per parameter.
		The clustalw hgapresidue parameter is a List with multiple vdef values.

		- Sometimes vdef values are within double quotes in the pise and the double quotes
		need to be stripped off.  
	*/
	function getDefaultValue($node)
	{
		var vdef = $node.children('attributes').children('vdef').children('value');
		var paramType = $node.attr('type');
		var defaultValue = null;
		var defaultValueArray = [];
		if (vdef)
		{
			var value;
			$(vdef).each(function() 
			{
				value = $(this).text();
				// remove leading and trailing double quotes.  TODO: better way to do this?
				value = value.replace("/", "");
				value = value.replace(/"([^"]*)$/,'$1');
				if (paramType == "List")
				{
					defaultValueArray.push(value);
				} else if (!defaultValue)
				{
					defaultValue = value;
					if (paramType == "Switch")
					{
						defaultValue = (defaultValue == "1") ? true : false;
					}
				}
			});
			return (paramType == "List") ? defaultValueArray : defaultValue;
		} else
		{
			return null;
		}
	}

	// Called whenever any element's value changes.  
	function resolveParameters(event)
	{
		// iterate over all form elements that have preconds and enable/disable them
		var elementsWithPreconds = $('*').filter(function() { return $(this).data('precond') !== undefined; });
		$.each(elementsWithPreconds, function() {
			var precondStr = $(this).data('precond');
			disable( $(this).attr('id'),  !resolveCode($(this), precondStr));
		});
	}

	/*
		Disable or enable a form element
		- parameter is name of parameter (i.e. element's 'id' attribute)
		- flag is a boolean
	*/
	function disable(parameter, flag)
	{
		var element = $('#' + parameter);
		if (element)
		{
			element.prop('disabled', flag); 
		}
	}

	/*
		- parameter is name of parameter (i.e. element's 'id' attribute)
	*/
	function isDisabled(parameter)
	{
		var element = $('#' + parameter);

		// JQuery always returns a jquery object, even when the id (or other select) isn't found.
		// It's length will be zero iff not found.
		if (element.length == 0)
		{
			return true;
		}
		var isDisabled = element.prop('disabled');
		return isDisabled;
	}

	/*
		Get the value of a form element
		- parameter is name of parameter (i.e. element's 'id' attribute)
		- for multiple select list (pise type "Excl") this only returns
		the first value in the list.  In cipres portal, that works ok where we 
		call getValue() but we aren't using getValue to submit the form elements,
		only to verify preconds and controls.
	*/
	function getValue(parameter)
	{
		var element = $('#' + parameter);

		if (element.length == 0)
		{
			return null;
		}
		// For checkbox type (i.e. a pise Switch) always return true or false
		if (element.prop('type') == 'checkbox')
		{
			if (isDisabled(parameter))
				return false;
			return element.is(":checked");
		}

		// For all other types, if disabled, return empty string
		if (isDisabled(parameter))
		{
			return "";
		}
		if (element.prop('type') == 'multipleSelect')
		{
			var selections = element.val();
			if (selections)
			{
				if (selections[0])
					return selections[0];
			}
			return "";
		}
		var retval = element.val();
		return retval;
	}

	return toolObj;

})();
