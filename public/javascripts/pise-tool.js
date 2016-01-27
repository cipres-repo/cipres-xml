/*
	TODO: 

		- Validation on submit:
			- need to validate pise min/max when they appear for Integer and Float types.

		- In insertElement() I corrected handling of "List" pise type.  It should be a multiple select
		control.  It is correct now but looks terrible.  Fix appearance?  To see it in action, choose
		tool = muscle and scroll down to "Diagonal Functions".

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
		- Can't use continue and break in JQuery each loop.  You need to return true (continue) or false (break)
		from the function instead.
		- empty string is false.
		- The css id of each element in the form is the same as the name of the corresponding pise parameter.
*/


var pise_tool = (function() {
	var vparams = {};
	var iparams = {};
	var tooldID = "";
	var theCallback;
	var theFileChooserType;
	var theFileChooser;

	var paramFilter = "parameter:not([ishidden='1']):not([type='Results']):not([type='OutFile'])";

	var toolObj = 
	{
		init : function(callback, fileChooserType, fileChooser)
		{
			if (callback)
			{
				theCallback = callback;
			} else
			{
				theCallback = toolObj.defaultCallback;
			}
			if (fileChooserType)
			{ 
				theFileChooserType = fileChooserType;
			} else
			{
				theFileChooserType = "default";
			}
			if (fileChooser)
			{
				theFileChooser = fileChooser;
			} else
			{
				theFileChooser = toolObj.defaultFileChooser;
			}
		},

		chooseTool :  function(tool_url, tooldiv_id, form_id)
		{
			$.ajax({ url: tool_url, type: 'GET', dataType: 'xml' }).then(function(data)
			{
				var list = "<select id='toolselector'>";
				$(data).find("tool").each(function(index, value) {
					var $node = $(value);
					var toolID = $node.find('toolId').text();
					var pise = $node.find('piseUri').find('url').text();
					list += "<option value='" + pise + "'" + "data-toolid='" + toolID + "'" + "'>" + toolID + "</option>";
				});
				list += "</select><br>";
				$(tooldiv_id).append(list);

				// If user supplies a form_id div we render the form when tool selection changes
				var $form = $(form_id);
				if ($form.length)
				{
					$("#toolselector").change(function() 
					{
						var toolID = $(this).find('option:selected').data('toolid');
						pise_tool.render_tool(toolID, $(this).val(), form_id);
					}); 
				}
			}); 
		},

		render_tool : function(toolID, url, form_id) 
		{	
			var $form = $(form_id);
			if (! $form.length)
			{
				alert("form must have div with id:" + form_id);
				return;
			}
			$form.empty();
			$form.append("<div class='form_fields'>");
			$form.append("<div class='simple'></div>");
			$form.append("<div class='advanced'></div>");
			$form.append('<input type="submit" value="View">');
			$form.append("</div>");
			$form.append("<dl class='comment'></dl>")

			// selectors for the simple and advanced divs.  E.g. $(containers.simContainer) is the simple container.
			var containers =
			{
				simContainer: $(form_id + " > div.simple"),
				advContainer: $(form_id  + " > div.advanced"),
				comContainer: $(form_id + " > dl.comment")
			};
			//append hidden fields that caller may want if he actually POSTS the form 
			$form.append('<input type="hidden" name="toolidjson" id="toolidjson">');
			$form.append('<input type="hidden" name="iparamsjson" id="iparamsjson">');
			$form.append('<input type="hidden" name="vparamsjson" id="vparamsjson">');

			//retrieve pisexml file.  Callback fn creates form elements from pisexml parameters.
			$.ajax({ url: url, type: 'GET', dataType: 'xml' }).then(function(data) 
			{
					//iterate through parameters
					$(data).find('pise > parameters > ' + paramFilter).each(function(index, value) 
					{
							var $value = $(value);
							if($value.attr('type') == 'Paragraph') 
							{
								insertToForm(value, containers, true);
								var id = $value.children('paragraph').children('name').text();
								var paraContainer = $("div#" + id);

								$value
									.find('paragraph > parameters > ' + paramFilter)
									.each(function(index, value) 
									{
										insertToForm(
											value, 
											{
												simContainer: paraContainer,
												advContainer: paraContainer,
												comContainer: containers.comContainer
											}, 
											false);
									});
							} else
							{
								insertToForm(value, containers, false);
							}
					});

				// Enable/disable elements based on their preconds.
				resolveParameters(null);

				//add collapse headings to simple and advanced containers
				/*
					This seems to be assuming there may be multiple "simple, advanced, .." sections.
					before() - Before each we insert a header
					prev() - is this needed to return the just inserted header?
					click() - add an on click fn that expands/collapses the following div, i.e the "div.simple, div.advanced, etc" 
					TODO: add a .click() to any sections you want to start out hidden.
				*/
				$form.children("div.simple")
					.before("<h2 class='container-header'>Simple Parameters</h2>")
					.prev()
					.click(function() { $(this).next().slideToggle() });
				$form.children("div.advanced")
					.before("<h2 class='container-header'>Advanced Parameters</h2>")
					.prev()
					.click(function() { $(this).next().slideToggle() });
				$form.children('dl.comment')
					.before("<h2 class='container-header'>Help</h2>")
					.prev()
					.click(function() { $(this).next().slideToggle() });
				// If no advanced parameters, hide the whole section
				if (! $(containers.advContainer).find('input', 'select').length)
				{
					// hide the header and the div that would have controls. 
					$(containers.advContainer).prev().hide();
					$(containers.advContainer).hide();
				}
			});

			/*
				Validate the form and if errors display an alert() and return false (so that form isn't submitted).
				If no validation errors, this fn calls the supplied callback method and returns whatever
				it returns.  
			*/
			$form.on('submit', function() 
			{
				console.log("In submit handler");
				if (validate($form) == false)
				{
					return false;
				}

				// Build list of vparams and iparams that the rest api will need.
				toolID = toolID;
				$form.find('input, select').each(function()
				{
					var type = $(this).data('pisetype');
					if (type && !isDisabled($(this)))
					{
						var id = $(this).attr('id');
						var value = $(this).val();
						
						if (!(value === null || value === ''))
						{
							if (type == 'InFile' || type == 'Sequence')
							{
								iparams[id] = value;
							} else if (type == 'Switch')  
							{
								vparams[id] = (value == 'on' ? '1' : '0');
							} else
							{
								vparams[id] = value;
							}
						}
					}
				});
				var istr = JSON.stringify(iparams);
				var vstr = JSON.stringify(vparams);
				$("#toolid").val(toolID);
				$("#iparamsjson").val(istr);
				$("#vparamsjson").val(vstr);
				return theCallback(toolID, istr, vstr);
			});
		}, // end renderTool()

		defaultCallback :   function(toolID, i, v)
		{
			var iparams = $.parseJSON(i);
			var vparams = $.parseJSON(v);

			console.log("This is the default form submit callback fn. Form submitted for tool: " + toolID)
			console.log("IPARAMS:");
			var key;
			for (key in iparams)
			{
				if (iparams.hasOwnProperty(key))
				{
					console.log(key + "=" + iparams[key]);
				}
			}
			console.log("VPARAMS:");
			for (key in vparams)
			{
				if (vparams.hasOwnProperty(key))
				{
					console.log(key + "=" + vparams[key]);
				}
			}
			return false;
		},

		ajaxPostCallback:  function(toolID, istr, vstr)
		{
			var pop = window.open("", "popupWindow", "width=800,height=600,scrollbars=yes");
			pop.focus();
			var request = $.ajax({
				type: 'POST',
				data:	'toolID=' + toolID + "&" + 	'iparams=' + istr + "&" + 'vparams=' + vstr,
				async: false 
			});
			request.done(function(html) {
				pop.document.write(html);
				pop.document.close();
			});
			request.fail(function(jqXHR, text, et) { alert(text); });
			return false;
		},

		defaultFileChooser : function()
		{
			console.log("This is the defaultFileChooser fn, returning foo.txt");
			return "foo.txt";
		}
	}; // end toolObj

	/*
		inserts individual parameters to form
		value: xml parameter
		paragraph: boolean - is element is a paragraph parameter ? 

		Store these data attributes with the element:
		'precond'       : if pise parameter has a precond
		'ctrls'         : if pise parameter has ctrls 
		'label'         :  the prompt text
		'ismandatory    : with a value of true, if pise parameter has isMandatory=1
	*/
	function insertToForm(value, containers, paragraph) 
	{
		var $node = $(value);
		var label;
		var precondCode;
		var ctrl; 
		var data;
		var comment;

		if (paragraph) 
		{
			/* ??? */
			$node = $node.children('paragraph');
			$node.attr('type', 'Paragraph');
			/* */
			label = $node.children('prompt').text();
			comment = $node.children('comment').text();
		}
		else 
		{
			label = $node.children('attributes').children('prompt').text();
			comment = $node.children('attributes').children('comment').text();
		}

		//append element to html form
		var element = insertElement(
			$node, 
			{
				label: label, 
				comment: comment,
				container: ($node.attr('issimple') == 1) ? containers.simContainer : containers.advContainer,
				comContainer: containers.comContainer
			});		

		/*
			Associate some data with the input element. Data has these keys:
				- 'precond'
				- 'ctrls' 
				- 'pisetype' (added by insertElement)
				- 'label'
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
		element.data('label', label);
	}

	//convert perl code snippet to javascript
	function sanitizeCode(code)
	{
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
	function resolveCode($element, code) 
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
				id  = $element.attr('id');

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
		//return(eval(code));
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

		switch (paramType)
		{
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
			default: // Integer, Float, String
				typeAttr = 'type="text" ';
		}
		//determine element values
		var elementID = $node.children('name').text();
		var name= 'name="' + elementID +  '" ';
		var id = 'id="' + elementID + '" ';

		var eString;
		var text;

		// Insert divs and heading for a paragraph
		if (para) 
		{
			eString = "<div " + name + id + "class='paragraph'></div>";
			text = "<h4 id='" + elementID + "-lab'>" + options.label + "</h4>";
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
				//###
				if (theFileChooserType == 'desktop' && (paramType == 'InFile' || paramType == 'Sequence'))
				{
					eString = '<a href="" id="link_' + elementID +'" >Select file </a><span class="filename" id="' + 'display_' + elementID + '"' +   '></span>';

					//eString += "<input " + name + id + "style='display:none"      + "><br>";
					//eString += "<input " + name + id +  "><br>";
					eString += "<input " + name + id +  " type='hidden'><br>";
				} else
				{
					eString = "<input " + name + id + typeAttr + " maxlength='600'><br>";
				}
			}
			text = "<label id='" + elementID + "-lab'>" + options.label + "</label>";
		}
		//append element to form
		options.container.append("<div class='form-group'>" + text + eString + "</div>");

		// Store pise datatype with the element.
		var element = $('#' + elementID);
		element.data('pisetype', paramType);

		// Store "ismandatory" attribute with the element
		if ($node.attr('ismandatory') == 1)
			element.data('ismandatory', true)

		// When any element changes, call resolveParameters
		element.change({source: elementID}, resolveParameters);

		var defaultValue = getDefaultValue($node);
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

		// insert help section
		insertComment(
			element.prev('label'),
			{
				label: options.label,
				comment: options.comment,
				comContainer: options.comContainer
			});

		$('#link_' + elementID).click(function(){
			var id = this.id.replace(/^link_/, '');
			if ($('#link_' + id).hasClass('disabled') == true)
			{
				return false;
			}
			var myval = theFileChooser();
			if (myval != null)
			{
				 $('#display_' +id).text(myval);
				 $('#' + id).val(myval);
			}
			return false;
		});

		return element;
	}

	function insertComment($eLabel, options) 
	{	
		if (options.comment == '')
			return;
		var comId = $eLabel.attr('id') + "-com";
		options.comContainer.append(
			"<dt id='" + comId + "'><a href='#" + $eLabel.attr('id') + "'>" + options.label + "</a></dt>" +
			"<dd>" + options.comment + "</dd>"
		);
		$eLabel.wrapInner('<a href="#' + comId + '"></a>');
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
			var $this = $(this);
			var precondStr = $this.data('precond');
			disable( $this,  !resolveCode($this, precondStr));
		});
	}

	/*
		Disable or enable a form element
		- element is the form input or select control.
		- flag is a boolean
	*/
	function disable($element, flag)
	{
		if ($element)
		{
			$element.prop('disabled', flag); 
			if (flag)
			{
				$element.parent('.form-group').addClass('disabled');
			} else
			{
				$element.parent('.form-group').removeClass('disabled');
			}

			if (theFileChooserType == 'desktop')
			{
				$('#link_' + $element.attr('id')).toggleClass('disabled', flag);
			}
		}
	}

	/*
		- element is the html input or select element.
	*/
	function isDisabled($element)
	{
		// JQuery always returns a jquery object, even when the id (or other select) isn't found.
		// It's length will be zero iff not found.
		if ($element.length == 0)
		{
			return true;
		}
		return $element.prop('disabled');
	}

	/*
		Get the value of a form element
		- parameter is name of parameter (i.e. element's 'id' attribute)
		- for multiple select list (pise type "Excl") this only returns
		the first value in the list.  In cipres portal, that works ok where we 
		call getValue() but we aren't using getValue to submit the form elements,
		only to verify preconds, controls and ismandatory.

		Returns:
		- null if there is no input element corresponding the pise parameter.  Shouldn't happen.
		- 0 or 1 for type Switch
		- a string, possibly empty.  
		- empty string if the parameter is disabled.

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
			if (isDisabled(element))
				return '';

			var v = element.is(":checked");
			return v ? 1 : 0;
		}

		// For all other types, if disabled, return empty string
		if (isDisabled(element))
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

	function validate($container)
	{
		var error = false;
		var messages = [];
		var invalidElems = [];
		// Validate datatype of Integer and Float parameters.
		$container.find('input').each(function()
		{
			var type = $(this).data('pisetype');
			var id = $(this).attr('id');
			var value = $(this).val();
			var label = $(this).data('label');
			//if (type && (type == 'Integer'))
			if (type && (type == 'Integer'))
			{
				if ( value && ! /^(0|[1-9]\d*)$/.test(value) )
				{
					console.log(label + " : is not an integer");
					messages.push(label + " : must be a positive integer.");
					invalidElems.push(id);
					error = true;
				}
					
			} else if (type && (type == 'Float'))
			{
				if ( value && ! /^\s*(\+|-)?((\d+(\.\d+)?)|(\.\d+))\s*$/.test(value) )
				{
					console.log(label +  " : is not float");
					messages.push(label + " :  must be a decimal number.");
					invalidElems.push(id);
					error = true;
				}
			} 
		});

		// iterate over all form elements that have controls 
		$('*').filter(function()
		{
			return $(this).data('ctrls') !== undefined;
		})
		.each(function() 
		{
			var $this = $(this);
			var label = $this.data('label');
			if (!isDisabled($this) &&  $.inArray($this.attr('id'), invalidElems) < 0)
			{
				var ctrls = $this.data('ctrls');
				var i;
				for (i = 0; i < ctrls.length; i++)
				{
					var code = ctrls[i].code;
					var message = ctrls[i].message;
					if (resolveCode($this, code))
					{
						console.log(message);
						messages.push(message);
						invalidElems.push($this.attr('id'));
						error = true;
						break; // report no more than one error per field
					}
				}
			}
		});

		//validate elements with ismandatory fields
		$('*').filter(function()
		{
			return $(this).data('ismandatory');
		})
		.each(function()
		{
			var $this = $(this);
			var id = $this.attr('id');
			var label = $this.data('label');
			if (!isDisabled($this) &&  $.inArray(id, invalidElems) < 0)
			{
				var value = getValue(id);
				if (value === null || value === '')
				{
					messages.push(label + " :  must have a value");	
					invalidElems.push($this.attr('id'));
					error = true;
				}
			}
		});
		if (error)
		{
			var mString = "There was an error with your submission:\n\n";
			for (var i = 0; i < messages.length; i++)
			{
				mString += "\u2022 " +  messages[i] + "\n";
			}
			alert(mString);
			return false;
		}
		return true;
	}

	return toolObj;

})();
