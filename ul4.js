/*!
 * UL4 JavaScript Library
 * http://www.livinglogic.de/Python/ul4c/
 *
 * Copyright 2011-2012 by LivingLogic AG, Bayreuth/Germany
 * Copyright 2011-2012 by Walter Dörwald
 *
 * All Rights Reserved
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/*jslint vars: true */
var ul4 = {
	version: "20",

	// REs for parsing JSON
	_rvalidchars: /^[\],:{}\s]*$/,
	_rvalidescape: /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,
	_rvalidtokens: /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,
	_rvalidbraces: /(?:^|:|,)(?:\s*\[)+/g,

	// Functions with the ``_op_`` prefix implement UL4 opcodes

	// Addition: num + num, string + string
	_op_add: function(obj1, obj2)
	{
		if (obj1 !== null && typeof(obj1.__add__) === "function")
			return obj1.__add__(obj2);
		else if (obj2 !== null && typeof(obj2.__radd__) === "function")
			return obj2.__radd__(obj1);
		if (obj1 === null || obj2 === null)
			throw this._fu_type(obj1) + " + " + this._fu_type(obj2) + " not supported";
		return obj1 + obj2;
	},

	// Substraction: num - num
	_op_sub: function(obj1, obj2)
	{
		if (obj2 !== null && typeof(obj1.__sub__) === "function")
			return obj1.__sub__(obj2);
		else if (obj2 !== null && typeof(obj2.__rsub__) === "function")
			return obj2.__rsub__(obj1);
		if (obj1 === null || obj2 === null)
			throw this._fu_type(obj1) + " - " + this._fu_type(obj2) + " not supported";
		return obj1 - obj2;
	},

	// Multiplication: num * num, int * str, str * int, int * list, list * int
	_op_mul: function(obj1, obj2)
	{
		if (obj1 !== null && typeof(obj1.__mul__) === "function")
			return obj1.__mul__(obj2);
		else if (obj2 !== null && typeof(obj2.__rmul__) === "function")
			return obj2.__rmul__(obj1);
		if (obj1 === null || obj2 === null)
			throw this._fu_type(obj1) + " * " + this._fu_type(obj2) + " not supported";
		else if (this._fu_isint(obj1) || this._fu_isbool(obj1))
		{
			if (typeof(obj2) === "string")
			{
				if (obj1 < 0)
					throw "mul() repetition counter must be positive";
				return this._str_repeat(obj2, obj1);
			}
			else if (this._fu_islist(obj2))
			{
				if (obj1 < 0)
					throw "mul() repetition counter must be positive";
				return this._list_repeat(obj2, obj1);
			}
		}
		else if (this._fu_isint(obj2) || this._fu_isbool(obj2))
		{
			if (typeof(obj1) === "string")
			{
				if (obj2 < 0)
					throw "mul() repetition counter must be positive";
				return this._str_repeat(obj1, obj2);
			}
			else if (this._fu_islist(obj1))
			{
				if (obj2 < 0)
					throw "mul() repetition counter must be positive";
				return this._list_repeat(obj1, obj2);
			}
		}
		return obj1 * obj2;
	},

	// Truncating division
	_op_floordiv: function(obj1, obj2)
	{
		if (obj1 !== null && typeof(obj1.__floordiv__) === "function")
			return obj1.__floordiv__(obj2);
		else if (obj2 !== null && typeof(obj2.__rfloordiv__) === "function")
			return obj2.__rfloordiv__(obj1);
		if (obj1 === null || obj2 === null)
			throw this._fu_type(obj1) + " // " + this._fu_type(obj2) + " not supported";
		return Math.floor(obj1 / obj2);
	},

	// "Real" division
	_op_truediv: function(obj1, obj2)
	{
		if (obj1 !== null && typeof(obj1.__truediv__) === "function")
			return obj1.__truediv__(obj2);
		else if (obj2 !== null && typeof(obj2.__rtruediv__) === "function")
			return obj2.__rtruediv__(obj1);
		if (obj1 === null || obj2 === null)
			throw this._fu_type(obj1) + " / " + this._fu_type(obj2) + " not supported";
		return obj1 / obj2;
	},

	// Modulo (this is non-trivial, because it follows the Python semantic of ``-5 % 2`` being ``1``)
	_op_mod: function(obj1, obj2)
	{
		var div = Math.floor(obj1 / obj2);
		var mod = obj1 - div * obj2;

		if (mod !== 0 && ((obj2 < 0 && mod > 0) || (obj2 > 0 && mod < 0)))
		{
			mod += obj2;
			--div;
		}
		return obj1 - div * obj2;
	},

	// Negation
	_op_neg: function(obj)
	{
		if (obj !== null && typeof(obj.__neg__) === "function")
			return obj.__neg__();
		return -obj;
	},

	// Not
	_op_not: function(obj)
	{
		return !this._fu_bool(obj);
	},

	// Containment test: string in string, obj in list, key in dict, value in rgb
	_op_contains: function(obj, container)
	{
		if (typeof(obj) === "string" && typeof(container) === "string")
		{
			return container.indexOf(obj) !== -1;
		}
		else if (this._fu_islist(container))
		{
			return container.indexOf(obj) !== -1;
		}
		else if (this._fu_isdict(container))
		{
			for (var key in container)
			{
				if (key === obj)
					return true;
			}
			return false;
		}
		else if (this._fu_iscolor(container))
		{
			return container.r === obj || container.g === obj || container.b === obj || container.a === obj;
		}
		throw "argument of type '" + this._fu_type(container) + "' is not iterable";
	},

	// Inverted containment test
	_op_notcontains: function(obj, container)
	{
		return !ul4._op_contains(obj, container);
	},

	// Comparison operator ==
	_op_eq: function(obj1, obj2)
	{
		if (typeof(obj1.__eq__) !== "undefined")
		{
			if (typeof(obj2.__eq__) !== "undefined")
				return obj1.__eq__(obj2);
			else
				return false;
		}
		else
		{
			if (typeof(obj2.__eq__) !== "undefined")
				return false;
			else
				return obj1 === obj2;
		}
	},

	// Comparison operator !=
	_op_ne: function(obj1, obj2)
	{
		if (typeof(obj1.__ne__) !== "undefined")
		{
			if (typeof(obj2.__ne__) !== "undefined")
				return obj1.__ne__(obj2);
			else
				return true;
		}
		else
		{
			if (typeof(obj2.__ne__) !== "undefined")
				return true;
			else
				return obj1 !== obj2;
		}
	},

	// Comparison operator <
	_op_lt: function(obj1, obj2)
	{
		if (typeof(obj1.__lt__) !== "undefined")
		{
			if (typeof(obj2.__lt__) !== "undefined")
				return obj1.__lt__(obj2);
			else
				throw "unorderable types: " + this._fu_type(obj1) + "() < " + this._fu_type(obj2) + "()";
		}
		else
		{
			if (typeof(obj2.__lt__) !== "undefined")
				throw "unorderable types: " + this._fu_type(obj1) + "() < " + this._fu_type(obj2) + "()";
			else
				return obj1 < obj2;
		}
	},

	// Comparison operator <=
	_op_le: function(obj1, obj2)
	{
		if (typeof(obj1.__le__) !== "undefined")
		{
			if (typeof(obj2.__le__) !== "undefined")
				return obj1.__le__(obj2);
			else
				throw "unorderable types: " + this._fu_type(obj1) + "() <= " + this._fu_type(obj2) + "()";
		}
		else
		{
			if (typeof(obj2.__lt__) !== "undefined")
				throw "unorderable types: " + this._fu_type(obj1) + "() <= " + this._fu_type(obj2) + "()";
			else
				return obj1 <= obj2;
		}
	},

	// Comparison operator >
	_op_gt: function(obj1, obj2)
	{
		if (typeof(obj1.__gt__) !== "undefined")
		{
			if (typeof(obj2.__gt__) !== "undefined")
				return obj1.__gt__(obj2);
			else
				throw "unorderable types: " + this._fu_type(obj1) + "() > " + this._fu_type(obj2) + "()";
		}
		else
		{
			if (typeof(obj2.__lt__) !== "undefined")
				throw "unorderable types: " + this._fu_type(obj1) + "() > " + this._fu_type(obj2) + "()";
			else
				return obj1 > obj2;
		}
	},

	// Comparison operator >=
	_op_ge: function(obj1, obj2)
	{
		if (typeof(obj1.__ge__) !== "undefined")
		{
			if (typeof(obj2.__ge__) !== "undefined")
				return obj1.__ge__(obj2);
			else
				throw "unorderable types: " + this._fu_type(obj1) + "() >= " + this._fu_type(obj2) + "()";
		}
		else
		{
			if (typeof(obj2.__lt__) !== "undefined")
				throw "unorderable types: " + this._fu_type(obj1) + "() >= " + this._fu_type(obj2) + "()";
			else
				return obj1 >= obj2;
		}
	},

	// Item access: dict[key], list[index], string[index], color[index]
	_op_getitem: function(container, key)
	{
		if (typeof(container) === "string" || this._fu_islist(container))
		{
			var orgkey = key;
			if (key < 0)
				key += container.length;
			return container[key];
		}
		else if (container !== null && typeof(container.__getitem__) === "function") // test this before the generic object test
			return container.__getitem__(key);
		else if (Object.prototype.toString.call(container) === "[object Object]")
			return container[key];
		throw "getitem() needs a sequence or dict";
	},

	// List/String slicing: string[start:stop], list[start:stop]
	_op_getslice: function(container, start, stop)
	{
		if (typeof(start) === "undefined" || start === null)
			start = 0;
		if (typeof(stop) === "undefined" || stop === null)
			stop = container.length;
		return container.slice(start, stop);
	},

	// Functions with the ``_fu_`` prefix implement UL4 functions

	// Check if ``obj`` is undefined
	_fu_isundefined: function(obj)
	{
		ul4._checkfuncargs("isundefined", arguments, 1);

		return typeof(obj) === "undefined";
	},

	// Check if ``obj`` is *not* undefined
	_fu_isdefined: function(obj)
	{
		ul4._checkfuncargs("isdefined", arguments, 1);

		return typeof(obj) !== "undefined";
	},

	// Check if ``obj`` is ``None``
	_fu_isnone: function(obj)
	{
		ul4._checkfuncargs("isnone", arguments, 1);

		return obj === null;
	},

	// Check if ``obj`` is a boolean
	_fu_isbool: function(obj)
	{
		ul4._checkfuncargs("isbool", arguments, 1);

		return typeof(obj) == "boolean";
	},

	// Check if ``obj`` is a int
	_fu_isint: function(obj)
	{
		ul4._checkfuncargs("isint", arguments, 1);

		return (typeof(obj) == "number") && Math.round(obj) == obj;
	},

	// Check if ``obj`` is a float
	_fu_isfloat: function(obj)
	{
		ul4._checkfuncargs("isfloat", arguments, 1);

		return (typeof(obj) == "number") && Math.round(obj) != obj;
	},

	// Check if ``obj`` is a string
	_fu_isstr: function(obj)
	{
		ul4._checkfuncargs("isstr", arguments, 1);

		return typeof(obj) == "string";
	},

	// Check if ``obj`` is a date
	_fu_isdate: function(obj)
	{
		ul4._checkfuncargs("isdate", arguments, 1);

		return Object.prototype.toString.call(obj) == "[object Date]";
	},

	// Check if ``obj`` is a color
	_fu_iscolor: function(obj)
	{
		ul4._checkfuncargs("iscolor", arguments, 1);

		return Object.prototype.toString.call(obj) == "[object Object]" && obj.__type__ === "color";
	},

	// Check if ``obj`` is a timedelta object
	_fu_istimedelta: function(obj)
	{
		ul4._checkfuncargs("istimedelta", arguments, 1);

		return Object.prototype.toString.call(obj) == "[object Object]" && obj.__type__ === "timedelta";
	},

	// Check if ``obj`` is a monthdelta object
	_fu_ismonthdelta: function(obj)
	{
		ul4._checkfuncargs("ismonthdelta", arguments, 1);

		return Object.prototype.toString.call(obj) == "[object Object]" && obj.__type__ === "monthdelta";
	},

	// Check if ``obj`` is a template
	_fu_istemplate: function(obj)
	{
		ul4._checkfuncargs("istemplate", arguments, 1);

		return Object.prototype.toString.call(obj) == "[object Object]" && obj.__type__ === "template";
	},

	// Check if ``obj`` is a list
	_fu_islist: function(obj)
	{
		ul4._checkfuncargs("islist", arguments, 1);

		return Object.prototype.toString.call(obj) == "[object Array]";
	},

	// Check if ``obj`` is a dict
	_fu_isdict: function(obj)
	{
		ul4._checkfuncargs("isdict", arguments, 1);

		return Object.prototype.toString.call(obj) == "[object Object]" && typeof(obj.__type__) === "undefined";
	},

	// Convert ``obj`` to bool, according to its "truth value"
	_fu_bool: function(obj)
	{
		ul4._checkfuncargs("bool", arguments, 0, 1);

		if (typeof(obj) === "undefined" || obj === null || obj === false || obj === 0 || obj === "")
			return false;
		else
		{
			if (typeof(obj.__bool__) === "function")
				return obj.__bool__();
			if (this._fu_islist(obj))
				return obj.length !== 0;
			else if (this._fu_isdict(obj))
			{
				for (var key in obj)
					return true;
				return false;
			}
			return true;
		}
	},

	// Create a color object from the red, green, blue and alpha values ``r``, ``g``, ``b`` and ``b``
	_fu_rgb: function(r, g, b, a)
	{
		ul4._checkfuncargs("rgb", arguments, 3, 4);

		return this.Color.create(255*r, 255*g, 255*b, typeof(a) == "undefined" ? 0xff : (255*a));
	},

	// Return the type of ``obj`` as a string
	_fu_type: function(obj)
	{
		ul4._checkfuncargs("type", arguments, 1);

		if (obj === null)
			return "none";
		else if (obj === false || obj === true)
			return "bool";
		else if (typeof(obj) === "string")
			return "str";
		else if (typeof(obj) === "number")
			return Math.round(obj) == obj ? "int" : "float";
		else if (this._fu_islist(obj))
			return "list";
		else if (this._fu_isdate(obj))
			return "date";
		else if (typeof(obj.__type__) !== "undefined")
			return obj.__type__;
		else if (this._fu_istimedelta(obj))
			return "timedelta";
		else if (this._fu_isdict(obj))
			return "dict";
		else if (this._fu_istemplate(obj))
			return "template";
		return null;
	},

	// Convert ``obj`` to a string
	_fu_str: function(obj)
	{
		ul4._checkfuncargs("str", arguments, 0, 1);

		if (typeof(obj) === "undefined")
			return "";
		else if (obj === null)
			return "";
		else if (obj === false)
			return "False";
		else if (obj === true)
			return "True";
		else if (typeof(obj) === "string")
			return obj;
		else if (typeof(obj) === "number")
			return obj.toString();
		else if (this._fu_isdate(obj))
			return this._date_str(obj);
		else if (this._fu_islist(obj))
		{
			var v = [];
			v.push("[");
			for (var i in obj)
			{
				if (i != 0)
					v.push(", ");
				v.push(this._fu_repr(obj[i]));
			}
			v.push("]");
			return v.join("");
		}
		else if (typeof(obj.__str__) === "function")
		{
			return obj.__str__();
		}
		else if (this._fu_isdict(obj))
		{
			var v = [];
			v.push("{");
			var i = 0;
			for (var key in obj)
			{
				if (i)
					v.push(", ");
				v.push(this._fu_repr(key));
				v.push(": ");
				v.push(this._fu_repr(obj[key]));
				++i;
			}
			v.push("}");
			return v.join("");
		}
		return "?";
	},

	// Convert ``obj`` to an integer (if ``base`` is given ``obj`` must be a string and ``base`` is the base for the conversion (default is 10))
	_fu_int: function(obj, base)
	{
		ul4._checkfuncargs("int", arguments, 0, 2);

		if (typeof(obj) === "undefined")
			return 0;
		var result;
		if (typeof(base) !== "undefined")
		{
			if (typeof(obj) !== "string" || !this._fu_isint(base))
				throw "int() requires a string and an integer";
			result = parseInt(obj, base);
			if (result.toString() == "NaN")
				throw "invalid literal for int()";
			return result;
		}
		else
		{
			if (typeof(obj) == "string")
			{
				result = parseInt(obj);
				if (result.toString() == "NaN")
					throw "invalid literal for int()";
				return result;
			}
			else if (typeof(obj) == "number")
				return Math.floor(obj);
			else if (obj === true)
				return 1;
			else if (obj === false)
				return 0;
			throw "int() argument must be a string or a number";
		}
	},

	// Convert ``obj`` to a float
	_fu_float: function(obj)
	{
		ul4._checkfuncargs("float", arguments, 0, 1);

		if (typeof(obj) === "undefined")
			return 0.0;
		if (typeof(obj) === "string")
			return parseFloat(obj);
		else if (typeof(obj) === "number")
			return obj;
		else if (obj === true)
			return 1.0;
		else if (obj === false)
			return 0.0;
		throw "float() argument must be a string or a number";
	},

	// Convert ``obj`` to a list
	_fu_list: function(obj)
	{
		ul4._checkfuncargs("list", arguments, 0, 1);

		if (typeof(obj) == "string" || this._fu_islist(obj))
		{
			var result = [];
			for (var key in obj)
				result.push(obj[key]);
			return result;
		}
		else if (this._fu_iscolor(obj))
		{
			return [obj.r, obj.g, obj.b, obj.a];
		}
		else if (this._fu_isdict(obj))
		{
			var result = [];
			for (var key in obj)
				result.push(key);
			return result;
		}
		else if (obj.__iter__)
		{
			var result = [];
			while (true)
			{
				var item = obj();
				if (item === null)
					break;
				result.push(item[0]);
			}
			return result;
		}
		throw "list() requires an iterable";
	},

	// Return whether any of the items in ``obj`` are true
	_fu_any: function(obj)
	{
		ul4._checkfuncargs("any", arguments, 1);

		if (typeof(obj) == "string")
		{
			for (var i = 0; i < obj.length; ++i)
			{
				if (obj[i] !== '\x00')
					return true;
			}
			return false;
		}
		else
		{
			var iter = this._iter(obj);

			for (;;)
			{
				var item = iter();
				if (item === null)
					return false;
				if (this._fu_bool(item[0]))
					return true;
			}
		}
	},

	// Return whether all of the items in ``obj`` are true
	_fu_all: function(obj)
	{
		ul4._checkfuncargs("any", arguments, 1);

		if (typeof(obj) == "string")
		{
			for (var i = 0; i < obj.length; ++i)
			{
				if (obj[i] === '\x00')
					return false;
			}
			return true;
		}
		else
		{
			var iter = this._iter(obj);

			for (;;)
			{
				var item = iter();
				if (item === null)
					return true;
				if (!this._fu_bool(item[0]))
					return false;
			}
		}
	},

	// Return the length of ``obj``
	_fu_len: function(obj)
	{
		ul4._checkfuncargs("len", arguments, 1);

		if (typeof(obj) == "string" || this._fu_islist(obj))
			return obj.length;
		else if (this._fu_isdict(obj))
		{
			var i = 0;
			for (var key in obj)
				++i;
			return i;
		}
		throw "object of type '" + this._fu_type(obj) + "' has no len()";
	},

	// Return a string representation of ``obj``: This should be an object supported by UL4
	_fu_repr: function(obj)
	{
		ul4._checkfuncargs("repr", arguments, 1);

		if (obj === null)
			return "None";
		else if (obj === false)
			return "False";
		else if (obj === true)
			return "True";
		else if (typeof(obj) === "string")
			return this._str_repr(obj);
		else if (typeof(obj) === "number")
			return "" + obj;
		else if (this._fu_isdate(obj))
			return this._date_repr(obj);
		else if (typeof(obj.__repr__) === "function")
			return obj.__repr__();
		else if (this._fu_islist(obj))
		{
			var v = [];
			v.push("[");
			for (var i = 0; i < obj.length; ++i)
			{
				if (i !== 0)
					v.push(", ");
				v.push(this._fu_repr(obj[i]));
			}
			v.push("]");
			return v.join("");
		}
		else if (this._fu_isdict(obj))
		{
			var v = [];
			v.push("{");
			var i = 0;
			for (var key in obj)
			{
				if (i)
					v.push(", ");
				v.push(this._fu_repr(key));
				v.push(": ");
				v.push(this._fu_repr(obj[key]));
				++i;
			}
			v.push("}");
			return v.join("");
		}
		return "?";
	},

	// Format ``obj`` using the format string ``format``
	_fu_format: function(obj, format, lang)
	{
		ul4._checkfuncargs("format", arguments, 2, 3);


		if (typeof(lang) === "undefined" || lang === null)
			lang = "en";
		else
		{
			lang = lang.toLowerCase();
			if (typeof(translations[lang]) === "undefined")
			{
				lang = lang.split(/_/)[0];
				if (typeof(translations[lang]) === "undefined")
					lang = "en";
			}
		}
		if (this._fu_isdate(obj))
			return this._fu_format_date(obj, format, lang);
		else if (this._fu_isint(obj))
			return this._fu_format_int(obj, format, lang);
		else if (obj === true)
			return this._fu_format_int(1, format, lang);
		else if (obj === false)
			return this._fu_format_int(0, format, lang);
	},

	_fu_format_date: function(obj, format, lang)
	{
		var translations = {
			de: {
				ms: ["Jan", "Feb", "M\u00e4r", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
				ml: ["Januar", "Februar", "M\u00e4rz", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
				ws: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
				wl: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
				xf: "%d.%m.%Y",
				Xf: "%H:%M:%S",
				cf: "%a %d %b %Y %H:%M:%S",
			},
			en: {
				ms: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
				ml: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
				ws: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
				wl: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
				xf: "%m/%d/%Y",
				Xf: "%H:%M:%S",
				cf: "%a %d %b %Y %I:%M:%S %p ",
			},
			fr: {
				ms: ["janv.", "f\u00e9vr.", "mars", "avril", "mai", "juin", "juil.", "ao\u00fbt", "sept.", "oct.", "nov.", "d\u00e9c."],
				ml: ["janvier", "f\u00e9vrier", "mars", "avril", "mai", "juin", "juillet", "ao\u00fbt", "septembre", "octobre", "novembre", "d\u00e9cembre"],
				ws: ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."],
				wl: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
				xf: "%d/%m/%Y",
				Xf: "%H:%M:%S",
				cf: "%a %d %b %Y %H:%M:%S",
			},
			es: {
				ms: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
				ml: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
				ws: ["dom", "lun", "mar", "mi\u00e9", "jue", "vie", "s\u00e1b"],
				wl: ["domingo", "lunes", "martes", "mi\u00e9rcoles", "jueves", "viernes", "s\u00e1bado"],
				xf: "%d/%m/%y",
				Xf: "%H:%M:%S",
				cf: "%a %d %b %Y %H:%M:%S",
			},
			it: {
				ms: ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"],
				ml: ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"],
				ws: ["dom", "lun", "mar", "mer", "gio", "ven", "sab"],
				wl: ["domenica", "luned\u00ec", "marted\u00ec", "mercoled\u00ec", "gioved\u00ec", "venerd\u00ec", "sabato"],
				xf: "%d/%m/%Y",
				Xf: "%H:%M:%S",
				cf: "%a %d %b %Y %H:%M:%S",
			},
			da: {
				ms: ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"],
				ml: ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"],
				ws: ["s\u00f8n", "man", "tir", "ons", "tor", "fre", "l\u00f8r"],
				wl: ["s\u00f8ndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "l\u00f8rdag"],
				xf: "%d-%m-%Y",
				Xf: "%H:%M:%S",
				cf: "%a %d %b %Y %H:%M:%S",
			},
			sv: {
				ms: ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"],
				ml: ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"],
				ws: ["s\u00f6n", "m\u00e5n", "tis", "ons", "tor", "fre", "l\u00f6r"],
				wl: ["s\u00f6ndag", "m\u00e5ndag", "tisdag", "onsdag", "torsdag", "fredag", "l\u00f6rdag"],
				xf: "%Y-%m-%d",
				Xf: "%H.%M.%S",
				cf: "%a %d %b %Y %H.%M.%S",
			},
			nl: {
				ms: ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"],
				ml: ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"],
				ws: ["zo", "ma", "di", "wo", "do", "vr", "za"],
				wl: ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"],
				xf: "%d-%m-%y",
				Xf: "%H:%M:%S",
				cf: "%a %d %b %Y %H:%M:%S",
			},
			pt: {
				ms: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
				ml: ["Janeiro", "Fevereiro", "Mar\u00e7o", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
				ws: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "S\u00e1b"],
				wl: ["Domingo", "Segunda", "Ter\u00e7a", "Quarta", "Quinta", "Sexta", "S\u00e1bado"],
				xf: "%d-%m-%Y",
				Xf: "%H:%M:%S",
				cf: "%a %d %b %Y %H:%M:%S",
			},
			cs: {
				ms: ["led", "\u00fano", "b\u0159e", "dub", "kv\u011b", "\u010den", "\u010dec", "srp", "z\u00e1\u0159", "\u0159\u00edj", "lis", "pro"],
				ml: ["leden", "\u00fanor", "b\u0159ezen", "duben", "kv\u011bten", "\u010derven", "\u010dervenec", "srpen", "z\u00e1\u0159\u00ed", "\u0159\u00edjen", "listopad", "prosinec"],
				ws: ["Ne", "Po", "\u00dat", "St", "\u010ct", "P\u00e1", "So"],
				wl: ["Ned\u011ble", "Pond\u011bl\u00ed", "\u00dater\u00fd", "St\u0159eda", "\u010ctvrtek", "P\u00e1tek", "Sobota"],
				xf: "%d.%m.%Y",
				Xf: "%H:%M:%S",
				cf: "%a\u00a0%d.\u00a0%B\u00a0%Y,\u00a0%H:%M:%S",
			},
			sk: {
				ms: ["jan", "feb", "mar", "apr", "m\u00e1j", "j\u00fan", "j\u00fal", "aug", "sep", "okt", "nov", "dec"],
				ml: ["janu\u00e1r", "febru\u00e1r", "marec", "apr\u00edl", "m\u00e1j", "j\u00fan", "j\u00fal", "august", "september", "okt\u00f3ber", "november", "december"],
				ws: ["Ne", "Po", "Ut", "St", "\u0160t", "Pi", "So"],
				wl: ["Nede\u013ea", "Pondelok", "Utorok", "Streda", "\u0160tvrtok", "Piatok", "Sobota"],
				xf: "%d.%m.%Y",
				Xf: "%H:%M:%S",
				cf: "%a\u00a0%d.\u00a0%B\u00a0%Y,\u00a0%H:%M:%S",
			},
			pl: {
				ms: ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "pa\u017a", "lis", "gru"],
				ml: ["stycze\u0144", "luty", "marzec", "kwiecie\u0144", "maj", "czerwiec", "lipiec", "sierpie\u0144", "wrzesie\u0144", "pa\u017adziernik", "listopad", "grudzie\u0144"],
				ws: ["nie", "pon", "wto", "\u015bro", "czw", "pi\u0105", "sob"],
				wl: ["niedziela", "poniedzia\u0142ek", "wtorek", "\u015broda", "czwartek", "pi\u0105tek", "sobota"],
				xf: "%d.%m.%Y",
				Xf: "%H:%M:%S",
				cf: "%a, %d %b %Y, %H:%M:%S",
			},
			hr: {
				ms: ["Sij", "Vel", "O\u017eu", "Tra", "Svi", "Lip", "Srp", "Kol", "Ruj", "Lis", "Stu", "Pro"],
				ml: ["Sije\u010danj", "Velja\u010da", "O\u017eujak", "Travanj", "Svibanj", "Lipanj", "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac"],
				ws: ["Ned", "Pon", "Uto", "Sri", "\u010cet", "Pet", "Sub"],
				wl: ["Nedjelja", "Ponedjeljak", "Utorak", "Srijeda", "\u010cetvrtak", "Petak", "Subota"],
				xf: "%d.%m.%Y",
				Xf: "%H:%M:%S",
				cf: "%a %d %b %Y %H:%M:%S",
			},
			sr: {
				ms: ["\u0458\u0430\u043d", "\u0444\u0435\u0431", "\u043c\u0430\u0440", "\u0430\u043f\u0440", "\u043c\u0430\u0458", "\u0458\u0443\u043d", "\u0458\u0443\u043b", "\u0430\u0432\u0433", "\u0441\u0435\u043f", "\u043e\u043a\u0442", "\u043d\u043e\u0432", "\u0434\u0435\u0446"],
				ml: ["\u0458\u0430\u043d\u0443\u0430\u0440", "\u0444\u0435\u0431\u0440\u0443\u0430\u0440", "\u043c\u0430\u0440\u0442", "\u0430\u043f\u0440\u0438\u043b", "\u043c\u0430\u0458", "\u0458\u0443\u043d", "\u0458\u0443\u043b", "\u0430\u0432\u0433\u0443\u0441\u0442", "\u0441\u0435\u043f\u0442\u0435\u043c\u0431\u0430\u0440", "\u043e\u043a\u0442\u043e\u0431\u0430\u0440", "\u043d\u043e\u0432\u0435\u043c\u0431\u0430\u0440", "\u0434\u0435\u0446\u0435\u043c\u0431\u0430\u0440"],
				ws: ["\u043d\u0435\u0434", "\u043f\u043e\u043d", "\u0443\u0442\u043e", "\u0441\u0440\u0435", "\u0447\u0435\u0442", "\u043f\u0435\u0442", "\u0441\u0443\u0431"],
				wl: ["\u043d\u0435\u0434\u0435\u0459\u0430", "\u043f\u043e\u043d\u0435\u0434\u0435\u0459\u0430\u043a", "\u0443\u0442\u043e\u0440\u0430\u043a", "\u0441\u0440\u0435\u0434\u0430", "\u0447\u0435\u0442\u0432\u0440\u0442\u0430\u043a", "\u043f\u0435\u0442\u0430\u043a", "\u0441\u0443\u0431\u043e\u0442\u0430"],
				xf: "%d.%m.%Y.",
				Xf: "%H:%M:%S",
				cf: "%A, %d. %B %Y. %H:%M:%S",
			},
			ro: {
				ms: ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"],
				ml: ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"],
				ws: ["Du", "Lu", "Ma", "Mi", "Jo", "Vi", "Sb"],
				wl: ["duminic\u0103", "luni", "mar\u0163i", "miercuri", "joi", "vineri", "s\u00e2mb\u0103t\u0103"],
				xf: "%d.%m.%Y",
				Xf: "%H:%M:%S",
				cf: "%a %d %b %Y %H:%M:%S",
			},
			hu: {
				ms: ["jan", "febr", "m\u00e1rc", "\u00e1pr", "m\u00e1j", "j\u00fan", "j\u00fal", "aug", "szept", "okt", "nov", "dec"],
				ml: ["janu\u00e1r", "febru\u00e1r", "m\u00e1rcius", "\u00e1prilis", "m\u00e1jus", "j\u00fanius", "j\u00falius", "augusztus", "szeptember", "okt\u00f3ber", "november", "december"],
				ws: ["v", "h", "k", "sze", "cs", "p", "szo"],
				wl: ["vas\u00e1rnap", "h\u00e9tf\u0151", "kedd", "szerda", "cs\u00fct\u00f6rt\u00f6k", "p\u00e9ntek", "szombat"],
				xf: "%Y-%m-%d",
				Xf: "%H.%M.%S",
				cf: "%Y. %b. %d., %A, %H.%M.%S",
			},
			tr: {
				ms: ["Oca", "\u015eub", "Mar", "Nis", "May", "Haz", "Tem", "A\u011fu", "Eyl", "Eki", "Kas", "Ara"],
				ml: ["Ocak", "\u015eubat", "Mart", "Nisan", "May\u0131s", "Haziran", "Temmuz", "A\u011fustos", "Eyl\u00fcl", "Ekim", "Kas\u0131m", "Aral\u0131k"],
				ws: ["Paz", "Pzt", "Sal", "\u00c7r\u015f", "Pr\u015f", "Cum", "Cts"],
				wl: ["Pazar", "Pazartesi", "Sal\u0131", "\u00c7ar\u015famba", "Per\u015fembe", "Cuma", "Cumartesi"],
				xf: "%d-%m-%Y",
				Xf: "%H:%M:%S",
				cf: "%a %d %b %Y %H:%M:%S",
			},
			ru: {
				ms: ["\u042f\u043d\u0432", "\u0424\u0435\u0432", "\u041c\u0430\u0440", "\u0410\u043f\u0440", "\u041c\u0430\u0439", "\u0418\u044e\u043d", "\u0418\u044e\u043b", "\u0410\u0432\u0433", "\u0421\u0435\u043d", "\u041e\u043a\u0442", "\u041d\u043e\u044f", "\u0414\u0435\u043a"],
				ml: ["\u042f\u043d\u0432\u0430\u0440\u044c", "\u0424\u0435\u0432\u0440\u0430\u043b\u044c", "\u041c\u0430\u0440\u0442", "\u0410\u043f\u0440\u0435\u043b\u044c", "\u041c\u0430\u0439", "\u0418\u044e\u043d\u044c", "\u0418\u044e\u043b\u044c", "\u0410\u0432\u0433\u0443\u0441\u0442", "\u0421\u0435\u043d\u0442\u044f\u0431\u0440\u044c", "\u041e\u043a\u0442\u044f\u0431\u0440\u044c", "\u041d\u043e\u044f\u0431\u0440\u044c", "\u0414\u0435\u043a\u0430\u0431\u0440\u044c"],
				ws: ["\u0412\u0441\u043a", "\u041f\u043d\u0434", "\u0412\u0442\u0440", "\u0421\u0440\u0434", "\u0427\u0442\u0432", "\u041f\u0442\u043d", "\u0421\u0431\u0442"],
				wl: ["\u0412\u043e\u0441\u043a\u0440\u0435\u0441\u0435\u043d\u044c\u0435", "\u041f\u043e\u043d\u0435\u0434\u0435\u043b\u044c\u043d\u0438\u043a", "\u0412\u0442\u043e\u0440\u043d\u0438\u043a", "\u0421\u0440\u0435\u0434\u0430", "\u0427\u0435\u0442\u0432\u0435\u0440\u0433", "\u041f\u044f\u0442\u043d\u0438\u0446\u0430", "\u0421\u0443\u0431\u0431\u043e\u0442\u0430"],
				xf: "%d.%m.%Y",
				Xf: "%H:%M:%S",
				cf: "%a %d %b %Y %H:%M:%S",
			},
			zh: {
				ms: [" 1\u6708", " 2\u6708", " 3\u6708", " 4\u6708", " 5\u6708", " 6\u6708", " 7\u6708", " 8\u6708", " 9\u6708", "10\u6708", "11\u6708", "12\u6708"],
				ml: ["\u4e00\u6708", "\u4e8c\u6708", "\u4e09\u6708", "\u56db\u6708", "\u4e94\u6708", "\u516d\u6708", "\u4e03\u6708", "\u516b\u6708", "\u4e5d\u6708", "\u5341\u6708", "\u5341\u4e00\u6708", "\u5341\u4e8c\u6708"],
				ws: ["\u65e5", "\u4e00", "\u4e8c", "\u4e09", "\u56db", "\u4e94", "\u516d"],
				wl: ["\u661f\u671f\u65e5", "\u661f\u671f\u4e00", "\u661f\u671f\u4e8c", "\u661f\u671f\u4e09", "\u661f\u671f\u56db", "\u661f\u671f\u4e94", "\u661f\u671f\u516d"],
				xf: "%Y\u5e74%b%d\u65e5",
				Xf: "%H\u65f6%M\u5206%S\u79d2",
				cf: "%Y\u5e74%b%d\u65e5 %A %H\u65f6%M\u5206%S\u79d2",
			},
			ko: {
				ms: [" 1\uc6d4", " 2\uc6d4", " 3\uc6d4", " 4\uc6d4", " 5\uc6d4", " 6\uc6d4", " 7\uc6d4", " 8\uc6d4", " 9\uc6d4", "10\uc6d4", "11\uc6d4", "12\uc6d4"],
				ml: ["1\uc6d4", "2\uc6d4", "3\uc6d4", "4\uc6d4", "5\uc6d4", "6\uc6d4", "7\uc6d4", "8\uc6d4", "9\uc6d4", "10\uc6d4", "11\uc6d4", "12\uc6d4"],
				ws: ["\uc77c", "\uc6d4", "\ud654", "\uc218", "\ubaa9", "\uae08", "\ud1a0"],
				wl: ["\uc77c\uc694\uc77c", "\uc6d4\uc694\uc77c", "\ud654\uc694\uc77c", "\uc218\uc694\uc77c", "\ubaa9\uc694\uc77c", "\uae08\uc694\uc77c", "\ud1a0\uc694\uc77c"],
				xf: "%Y\ub144 %B %d\uc77c",
				Xf: "%H\uc2dc %M\ubd84 %S\ucd08",
				cf: "%Y\ub144 %B %d\uc77c (%a) %p %I\uc2dc %M\ubd84 %S\ucd08",
			},
			ja: {
				ms: [" 1\u6708", " 2\u6708", " 3\u6708", " 4\u6708", " 5\u6708", " 6\u6708", " 7\u6708", " 8\u6708", " 9\u6708", "10\u6708", "11\u6708", "12\u6708"],
				ml: ["1\u6708", "2\u6708", "3\u6708", "4\u6708", "5\u6708", "6\u6708", "7\u6708", "8\u6708", "9\u6708", "10\u6708", "11\u6708", "12\u6708"],
				ws: ["\u65e5", "\u6708", "\u706b", "\u6c34", "\u6728", "\u91d1", "\u571f"],
				wl: ["\u65e5\u66dc\u65e5", "\u6708\u66dc\u65e5", "\u706b\u66dc\u65e5", "\u6c34\u66dc\u65e5", "\u6728\u66dc\u65e5", "\u91d1\u66dc\u65e5", "\u571f\u66dc\u65e5"],
				xf: "%Y\u5e74%B%d\u65e5",
				Xf: "%H\u6642%M\u5206%S\u79d2",
				cf: "%Y\u5e74%B%d\u65e5 %H\u6642%M\u5206%S\u79d2",
			}
		};

		var translation = translations[lang];

		var firstday;

		var result = [];
		var inspec = false;
		for (var i in format)
		{
			var c = format[i];
			if (inspec)
			{
				switch (c)
				{
					case "a":
						c = translation.ws[obj.getDay()];
						break;
					case "A":
						c = translation.wl[obj.getDay()];
						break;
					case "b":
						c = translation.ms[obj.getMonth()];
						break;
					case "B":
						c = translation.ml[obj.getMonth()];
						break;
					case "c":
						c = ul4._fu_format(obj, translation.cf, lang);
						break;
					case "d":
						c = this._lpad(obj.getDate(), "0", 2);
						break;
					case "f":
						c = this._lpad(obj.getMilliseconds(), "0", 3) + "000";
						break;
					case "H":
						c = this._lpad(obj.getHours(), "0", 2);
						break;
					case "I":
						c = this._lpad(((obj.getHours()-1) % 12)+1, "0", 2);
						break;
					case "j":
						c = this._lpad(this._me_yearday(obj), "0", 3);
						break;
					case "m":
						c = this._lpad(obj.getMonth()+1, "0", 2);
						break;
					case "M":
						c = this._lpad(obj.getMinutes(), "0", 2);
						break;
					case "p":
						c = obj.getHours() < 12 ? "AM" : "PM";
						break;
					case "S":
						c = this._lpad(obj.getSeconds(), "0", 2);
						break;
					case "U":
						c = this._lpad(ul4._me_week(obj, 6), "0", 2);
						break;
					case "w":
						c = obj.getDay();
						break;
					case "W":
						c = this._lpad(ul4._me_week(obj, 0), "0", 2);
						break;
					case "x":
						c = ul4._fu_format(obj, translation.xf, lang);
						break;
					case "X":
						c = ul4._fu_format(obj, translation.Xf, lang);
						break;
					case "y":
						c = (obj.getFullYear() % 100).toString();
						break;
					case "Y":
						c = obj.getFullYear().toString();
						break;
					case "z":
						// UTC offset in the form +HHMM or -HHMM
						c = "";
						break;
					case "Z":
						// Time zone name
						c = "";
						break;
				}
				result.push(c);
				inspec = false;
			}
			else
			{
				if (c == "%")
					inspec = true;
				else
					result.push(c);
			}
		}
		return result.join("");
	},

	_fu_format_int: function(obj, format, lang)
	{
		var work = format;

		// Defaults
		var fill = ' ';
		var align = '>'; // '<', '>', '=' or '^'
		var sign = '-'; // '+', '-' or ' '
		var alternate = false;
		var minimumwidth = 0;
		var type = 'd'; // 'b', 'c', 'd', 'o', 'x', 'X' or 'n'

		// Determine output type
		if (/[bcdoxXn]$/.test(work))
		{
			type = work.substring(work.length-1);
			work = work.substring(0, work.length-1);
		}

		// Extract minimum width
		if (/\d+$/.test(work))
		{
			var minimumwidthStr = /\d+$/.exec(work);
			work = work.replace(/\d+$/, "");
			if (/^0/.test(minimumwidthStr))
			{
				align = '=';
				fill = '0';
			}
			minimumwidth = parseInt(minimumwidthStr);
		}

		// Alternate form?
		if (/#$/.test(work))
		{
			alternate = true;
			work = work.substring(0, work.length-1);
		}

		// Determine sign
		if (/[+ -]$/.test(work))
		{
			if (type == 'c')
				throw "sign not allowed for integer format type 'c'";
			sign = work.substring(work.length-1);
			work = work.substring(0, work.length-1);
		}

		// Extract fill and align char
		if (work.length >= 3)
			throw "illegal integer format string " + this._fu_repr(format);
		else if (work.length == 2)
		{
			if (/[<>=^]$/.test(work))
			{
				align = work[1];
				fill = work[0];
			}
			else
				throw "illegal integer format string " + this._fu_repr(format);
		}
		else if (work.length == 1)
		{
			if (/^[<>=^]$/.test(work))
				align = work;
			else
				throw "illegal integer format string " + this._fu_repr(format);
		}

		// Basic number formatting
		var neg = obj < 0;

		if (neg)
			obj = -obj;

		var output;
		switch (type)
		{
			case 'b':
				output = obj.toString(2);
				break;
			case 'c':
				if (neg || obj > 65535)
					throw "value out of bounds for c format";
				output = String.fromCharCode(obj);
				break;
			case 'd':
				output = obj.toString();
				break;
			case 'o':
				output = obj.toString(8);
				break;
			case 'x':
				output = obj.toString(16);
				break;
			case 'X':
				output = obj.toString(16).toUpperCase();
				break;
			case 'n':
				// FIXME: locale formatting
				output = obj.toString();
				break;
		}

		// The rest of the formatting
		if (align === '=')
		{
			if (neg || sign !== '-')
				--minimumwidth;
			if (alternate && (type === 'b' || type === 'o' || type === 'x' || type === 'X'))
				minimumwidth -= 2;

			if (output.length < minimumwidth)
				output = this._str_repeat(fill, minimumwidth-output.length) + output;

			if (alternate && (type === 'b' || type === 'o' || type === 'x' || type === 'X'))
				output = "0" + type + output;

			if (neg)
				output = "-" + output;
			else if (sign != '-')
				output = sign + output;
		}
		else
		{
			if (alternate && (type == 'b' || type == 'o' || type == 'x' || type == 'X'))
				output = "0" + type + output;
			if (neg)
				output = "-" + output;
			else if (sign != '-')
				output = sign + output;
			if (output.length < minimumwidth)
			{
				if (align == '<')
					output = output + this._str_repeat(fill, minimumwidth-output.length);
				else if (align == '>')
					output = this._str_repeat(fill, minimumwidth-output.length) + output;
				else // if (align == '^')
				{
					var pad = minimumwidth - output.length;
					var padBefore = Math.floor(pad/2);
					var padAfter = pad-padBefore;
					output = this._str_repeat(fill, padBefore) + output + this._str_repeat(fill, padAfter);
				}
			}
		}
		return output;
	},

	// Convert ``obj`` to a string and escape the characters ``&``, ``<``, ``>``, ``'`` and ``"`` with their XML character/entity reference
	_fu_xmlescape: function(obj)
	{
		ul4._checkfuncargs("xmlescape", arguments, 1);

		obj = this._fu_str(obj);
		obj = obj.replace(/&/g, "&amp;");
		obj = obj.replace(/</g, "&lt;");
		obj = obj.replace(/>/g, "&gt;");
		obj = obj.replace(/'/g, "&#39;");
		obj = obj.replace(/"/g, "&quot;");
		return obj;
	},

	// Convert ``obj`` to a string suitable for output into a CSV file
	_fu_csv: function(obj)
	{
		ul4._checkfuncargs("csv", arguments, 1);

		if (obj === null)
			return "";
		else if (typeof(obj) !== "string")
			obj = this._fu_repr(obj);
		if (obj.indexOf(",") !== -1 || obj.indexOf('"') !== -1 || obj.indexOf("\n") !== -1)
			obj = '"' + obj.replace(/"/g, '""') + '"';
		return obj;
	},

	// Return a string containing one charcter with the codepoint ``obj``
	_fu_chr: function(obj)
	{
		ul4._checkfuncargs("chr", arguments, 1);

		if (typeof(obj) != "number")
			throw "chr() requires an int";
		return String.fromCharCode(obj);
	},

	// Return the codepoint for the one and only character in the string ``obj``
	_fu_ord: function(obj)
	{
		ul4._checkfuncargs("ord", arguments, 1);

		if (typeof(obj) != "string" || obj.length != 1)
			throw "ord() requires a string of length 1";
		return obj.charCodeAt(0);
	},

	// Convert an integer to a hexadecimal string
	_fu_hex: function(obj)
	{
		ul4._checkfuncargs("hex", arguments, 1);

		if (typeof(obj) != "number")
			throw "hex() requires an int";
		if (obj < 0)
			return "-0x" + obj.toString(16).substr(1);
		else
			return "0x" + obj.toString(16);
	},

	// Convert an integer to a octal string
	_fu_oct: function(obj)
	{
		ul4._checkfuncargs("oct", arguments, 1);

		if (typeof(obj) != "number")
			throw "oct() requires an int";
		if (obj < 0)
			return "-0o" + obj.toString(8).substr(1);
		else
			return "0o" + obj.toString(8);
	},

	// Convert an integer to a binary string
	_fu_bin: function(obj)
	{
		ul4._checkfuncargs("bin", arguments, 1);

		if (typeof(obj) != "number")
			throw "bin() requires an int";
		if (obj < 0)
			return "-0b" + obj.toString(2).substr(1);
		else
			return "0b" + obj.toString(2);
	},

	// Return the minimum value
	_fu_min: function()
	{
		ul4._checkfuncargs("min", arguments, 1, null);

		var obj;
		if (arguments.length > 1)
			obj = Array.prototype.slice.call(arguments, 0);
		else
			obj = arguments[0];
		var iter = this._iter(obj);
		var result;
		var first = true;
		while (true)
		{
			var item = iter();
			if (item === null)
			{
				if (first)
					throw "min() arg is an empty sequence!";
				return result;
			}
			if (first || (item[0] < result))
				result = item[0];
			first = false;
		}
	},

	// Return the maximum value
	_fu_max: function()
	{
		ul4._checkfuncargs("max", arguments, 1, null);

		var obj;
		if (arguments.length > 1)
			obj = Array.prototype.slice.call(arguments, 0);
		else
			obj = arguments[0];
		var iter = this._iter(obj);
		var result;
		var first = true;
		while (true)
		{
			var item = iter();
			if (item === null)
			{
				if (first)
					throw "max() arg is and empty sequence!";
				return result;
			}
			if (first || (item[0] > result))
				result = item[0];
			first = false;
		}
	},

	// Return a sorted version of ``obj``
	_fu_sorted: function(obj)
	{
		ul4._checkfuncargs("sorted", arguments, 1);

		var result = this._fu_list(obj);
		result.sort();
		return result;
	},

	// Return a iterable object iterating from ``start`` upto (but not including) ``stop`` with a step size of ``step``
	_fu_range: function(start, stop, step)
	{
		ul4._checkfuncargs("range", arguments, 1, 3);

		if (typeof(step) == "undefined")
		{
			step = 1;
			if (typeof(stop) == "undefined")
			{
				stop = start;
				start = 0;
			}
		}
		var lower, higher;
		if (step === 0)
			throw "range() requires a step argument != 0";
		else if (step > 0)
		{
			lower = start;
			heigher = stop;
		}
		else
		{
			lower = stop;
			heigher = start;
		}
		var length = (lower < heigher) ? Math.floor((heigher - lower - 1)/Math.abs(step)) + 1 : 0;

		var i = 0;
		var result = function()
		{
			if (i >= length)
				return null;
			return [start + (i++) * step];
		};
		return ul4._markiter(result);
	},

	// Encodes ``obj`` in the Javascript Object Notation (see http://json.org/; with support for dates, colors and templates)
	_fu_asjson: function(obj)
	{
		ul4._checkfuncargs("asjson", arguments, 1);

		if (obj === null)
			return "null";
		else if (typeof(obj) === "undefined")
			return "{}.undefined";
		else if (obj === false)
			return "false";
		else if (obj === true)
			return "true";
		else if (typeof(obj) === "string")
			return this._str_json(obj);
		else if (typeof(obj) === "number")
		{
			return "" + obj;
		}
		else if (this._fu_islist(obj))
		{
			var v = [];
			v.push("[");
			for (var i = 0; i < obj.length; ++i)
			{
				if (i != 0)
					v.push(", ");
				v.push(this._fu_asjson(obj[i]));
			}
			v.push("]");
			return v.join("");
		}
		else if (this._fu_isdict(obj))
		{
			var v = [];
			v.push("{");
			var i = 0;
			for (var key in obj)
			{
				if (i)
					v.push(", ");
				v.push(this._fu_asjson(key));
				v.push(": ");
				v.push(this._fu_asjson(obj[key]));
				++i;
			}
			v.push("}");
			return v.join("");
		}
		else if (this._fu_isdate(obj))
		{
			return "new Date(" + obj.getFullYear() + ", " + obj.getMonth() + ", " + obj.getDate() + ", " + obj.getHours() + ", " + obj.getMinutes() + ", " + obj.getSeconds() + ", " + obj.getMilliseconds() + ")";
		}
		else if (this._fu_istimedelta(obj))
		{
			return "ul4.TimeDelta.create(" + obj.days + ", " + obj.seconds + ", " + obj.microseconds + ")";
		}
		else if (this._fu_ismonthdelta(obj))
		{
			return "ul4.MonthDelta.create(" + obj.months + ")";
		}
		else if (this._fu_iscolor(obj))
		{
			return "ul4.Color.create(" + obj.r + ", " + obj.g + ", " + obj.b + ", " + obj.a + ")";
		}
		else if (this._fu_istemplate(obj))
		{
			return "ul4.Template.loads(" + ul4._fu_repr(obj.dumps()) + ")";
		}
		throw "json() requires a serializable object";
	},

	// Decodes the string ``obj`` from the Javascript Object Notation (see http://json.org/) and returns the resulting object
	_fu_fromjson: function(obj)
	{
		ul4._checkfuncargs("fromjson", arguments, 1);

		// The following is from jQuery's parseJSON function
		obj = ul4._me_strip(obj);
		if (typeof(window) !== "undefined" && window.JSON && window.JSON.parse)
			return window.JSON.parse(obj);
		if (ul4._rvalidchars.test(obj.replace(ul4._rvalidescape, "@").replace(ul4._rvalidtokens, "]").replace(ul4._rvalidbraces, "")))
			return (new Function("return " + obj))();
		throw "invalid JSON";
	},

	// Encodes ``obj`` in the UL4 Object Notation format
	_fu_asul4on: function(obj)
	{
		ul4._checkfuncargs("asul4on", arguments, 1);

		return ul4on.dumps(obj);
	},

	// Decodes the string ``obj`` from the UL4 Object Notation format and returns the resulting decoded object
	_fu_fromul4on: function(obj)
	{
		ul4._checkfuncargs("fromul4on", arguments, 1);

		return ul4on.loads(obj);
	},

	// ``%`` escape unsafe characters in the string ``obj``
	_fu_urlquote: function(obj)
	{
		ul4._checkfuncargs("urlquote", arguments, 1);
		return encodeURIComponent(obj);
	},

	// The inverse function of ``urlquote``
	_fu_urlunquote: function(obj)
	{
		ul4._checkfuncargs("urlunquote", arguments, 1);
		return decodeURIComponent(obj);
	},

	// Return a reverse iterator over ``obj``
	_fu_reversed: function(obj)
	{
		ul4._checkfuncargs("reversed", arguments, 1);

		if (typeof(obj) != "string" && !this._fu_islist(obj)) // We don't have to materialize strings or lists
			obj = this._fu_list(obj);
		var i = obj.length-1;
		var result = function()
		{
			return i >= 0 ? [obj[i--]] : null;
		};
		return ul4._markiter(result);
	},

	// Returns a random number in the interval ``[0;1[``
	_fu_random: function()
	{
		ul4._checkfuncargs("random", arguments, 0);

		return Math.random();
	},

	// Return a randomly select item from ``range(start, stop, step)``
	_fu_randrange: function(start, stop, step)
	{
		ul4._checkfuncargs("randrange", arguments, 1, 3);

		if (typeof(step) === "undefined")
		{
			step = 1;
			if (typeof(stop) === "undefined")
			{
				stop = start;
				start = 0;
			}
		}
		var width = stop-start;

		var value = Math.random();

		var n;
		if (step > 0)
			n = Math.floor((width + step - 1) / step);
		else if (step < 0)
			n = Math.floor((width + step + 1) / step);
		else
			throw "randrange() requires a step argument != 0";
		return start + step*Math.floor(value * n);
	},

	// Return a random item/char from the list/string ``obj``
	_fu_randchoice: function(obj)
	{
		ul4._checkfuncargs("randchoice", arguments, 1);

		var iscolor = this._fu_iscolor(obj);
		if (typeof(obj) !== "string" && !this._fu_islist(obj) && !iscolor)
			throw "randchoice() requires a string or list";
		if (iscolor)
			obj = this._fu_list(obj);
		return obj[Math.floor(Math.random() * obj.length)];
	},

	// Return an iterator over ``[index, item]`` lists from the iterable object ``obj``. ``index`` starts at ``start`` (defaulting to 0)
	_fu_enumerate: function(obj, start)
	{
		ul4._checkfuncargs("enumerate", arguments, 1, 2);
		if (typeof(start) === "undefined")
			start = 0;

		var iter = this._iter(obj);
		var i = start;
		var result = function()
		{
			var inner = iter();
			return inner !== null ? [[i++, inner[0]]] : null;
		};
		return ul4._markiter(result);
	},

	// Return an iterator over ``[isfirst, item]`` lists from the iterable object ``obj`` (``isfirst`` is true for the first item, false otherwise)
	_fu_isfirst: function(obj)
	{
		ul4._checkfuncargs("isfirst", arguments, 1);

		var iter = this._iter(obj);
		var isfirst = true;
		var result = function()
		{
			var inner = iter();
			var result = inner !== null ? [[isfirst, inner[0]]] : null;
			isfirst = false;
			return result;
		};
		return ul4._markiter(result);
	},

	// Return an iterator over ``[islast, item]`` lists from the iterable object ``obj`` (``islast`` is true for the last item, false otherwise)
	_fu_islast: function(obj)
	{
		ul4._checkfuncargs("islast", arguments, 1);

		var iter = this._iter(obj);
		var lastitem = iter();
		var result = function()
		{
			if (lastitem === null)
				return null;
			var inner = iter();
			var result = [[inner === null, lastitem[0]]];
			lastitem = inner;
			return result;
		};
		return ul4._markiter(result);
	},

	// Return an iterator over ``[isfirst, islast, item]`` lists from the iterable object ``obj`` (``isfirst`` is true for the first item, ``islast`` is true for the last item. Both are false otherwise)
	_fu_isfirstlast: function(obj)
	{
		ul4._checkfuncargs("isfirstlast", arguments, 1);

		var iter = this._iter(obj);
		var isfirst = true;
		var lastitem = iter();
		var result = function()
		{
			if (lastitem === null)
				return null;
			var inner = iter();
			var result = [[isfirst, inner === null, lastitem[0]]];
			lastitem = inner;
			isfirst = false;
			return result;
		};
		return ul4._markiter(result);
	},

	// Return an iterator over ``[index, isfirst, islast, item]`` lists from the iterable object ``obj`` (``isfirst`` is true for the first item, ``islast`` is true for the last item. Both are false otherwise)
	_fu_enumfl: function(obj, start)
	{
		ul4._checkfuncargs("enumfl", arguments, 1, 2);
		if (typeof(start) === "undefined")
			start = 0;

		var iter = this._iter(obj);
		var i = start;
		var isfirst = true;
		var lastitem = iter();
		var result = function()
		{
			if (lastitem === null)
				return null;
			var inner = iter();
			var result = [[i++, isfirst, inner === null, lastitem[0]]];
			lastitem = inner;
			isfirst = false;
			return result;
		};
		return ul4._markiter(result);
	},

	// Return an iterator over lists, where the i'th list consists of all i'th items from the arguments (terminating when the shortest argument ends)
	_fu_zip: function()
	{
		var result;
		if (arguments.length)
		{
			var iters = [];
			for (var i = 0; i < arguments.length; ++i)
				iters.push(this._iter(arguments[i]));

			result = function()
			{
				var items = [];
				for (var i in iters)
				{
					var item = iters[i]();
					if (item === null)
						return null;
					items.push(item[0]);
				}
				return [items];
			};
		}
		else
		{
			result = function()
			{
				return null;
			}
		}
		return ul4._markiter(result);
	},

	// Return the absolute value for the number ``obj``
	_fu_abs: function(obj)
	{
		ul4._checkfuncargs("abs", arguments, 1);

		return Math.abs(obj);
	},

	// Return a ``Date`` object for the current time
	_fu_now: function()
	{
		ul4._checkfuncargs("now", arguments, 0);

		return new Date();
	},

	// Return a ``Date`` object for the current time in UTC
	_fu_utcnow: function()
	{
		ul4._checkfuncargs("utcnow", arguments, 0);

		var now = new Date();
		// FIXME: The timezone is wrong for the new ``Date`` object.
		return new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds());
	},

	// Return a ``Date`` object from the arguments passed in
	_fu_date: function(year, month, day, hour, minute, second, microsecond)
	{
		ul4._checkfuncargs("date", arguments, 3, 7);

		if (typeof(hour) === "undefined")
			hour = 0;

		if (typeof(minute) === "undefined")
			minute = 0;

		if (typeof(second) === "undefined")
			second = 0;

		if (typeof(microsecond) === "undefined")
			microsecond = 0;

		return new Date(year, month-1, day, hour, minute, second, microsecond/1000);
	},

	// Return a ``TimeDelta`` object from the arguments passed in
	_fu_timedelta: function(days, seconds, microseconds)
	{
		ul4._checkfuncargs("timedelta", arguments, 0, 3);

		return this.TimeDelta.create(days, seconds, microseconds);
	},

	// Return a ``MonthDelta`` object from the arguments passed in
	_fu_monthdelta: function(months)
	{
		ul4._checkfuncargs("monthdelta", arguments, 0, 1);

		return this.MonthDelta.create(months);
	},

	// Return a ``Color`` object from the hue, luminescence, saturation and alpha values ``h``, ``l``, ``s`` and ``a`` (i.e. using the HLS color model)
	_fu_hls: function(h, l, s, a)
	{
		ul4._checkfuncargs("hls", arguments, 3, 4);

		if (typeof(a) === "undefined")
			a = 1;

		var _v = function(m1, m2, hue)
		{
			hue = hue % 1.0;
			if (hue < 1/6)
				return m1 + (m2-m1)*hue*6.0;
			else if (hue < 0.5)
				return m2;
			else if (hue < 2/3)
				return m1 + (m2-m1)*(2/3-hue)*6.0;
			return m1;
		};

		var m1, m2;
		if (typeof(a) === "undefined")
			a = 1;
		if (s === 0.0)
			return this._fu_rgb(l, l, l, a);
		if (l <= 0.5)
			m2 = l * (1.0+s);
		else
			m2 = l+s-(l*s);
		m1 = 2.0*l - m2;
		return this._fu_rgb(_v(m1, m2, h+1/3), _v(m1, m2, h), _v(m1, m2, h-1/3), a);
	},

	// Return a ``Color`` object from the hue, saturation, value and alpha values ``h``, ``s``, ``v`` and ``a`` (i.e. using the HSV color model)
	_fu_hsv: function(h, s, v, a)
	{
		ul4._checkfuncargs("hsv", arguments, 3, 4);
		if (typeof(a) === "undefined")
			a = 1;

		if (s === 0.0)
			return this._fu_rgb(v, v, v, a);
		var i = Math.floor(h*6.0);
		var f = (h*6.0) - i;
		var p = v*(1.0 - s);
		var q = v*(1.0 - s*f);
		var t = v*(1.0 - s*(1.0-f));
		switch (i%6)
		{
			case 0:
				return this._fu_rgb(v, t, p, a);
			case 1:
				return this._fu_rgb(q, v, p, a);
			case 2:
				return this._fu_rgb(p, v, t, a);
			case 3:
				return this._fu_rgb(p, q, v, a);
			case 4:
				return this._fu_rgb(t, p, v, a);
			case 5:
				return this._fu_rgb(v, p, q, a);
		}
	},

	_fu_get: function(vars, varname, defaultvalue)
	{
		if (arguments.length < 2 || arguments.length > 3)
			throw "function get() requires 1-2 arguments, " + (arguments.length-1) + " given";
		var result = vars[varname];
		if (typeof(result) === "undefined")
			result = defaultvalue;
		if (typeof(result) === "undefined")
			result = null;
		return result;
	},

	_fu_vars: function(vars)
	{
		if (arguments.length > 1)
			throw "function vars() requires 0 arguments, " + (arguments.length-1) + " given";
		return vars;
	},

	// Functions with the ``_me_`` prefix implement UL4 methods
	_me_replace: function(string, searchstring, replacestring, count)
	{
		ul4._checkmethargs("replace", arguments.length, 2, 3);
		if (typeof(count) === "undefined")
			count = string.length;

		var result = [];
		while (string.length)
		{
			var pos = string.indexOf(searchstring);
			if (pos === -1 || !count--)
			{
				result.push(string);
				break;
			}
			result.push(string.substr(0, pos));
			result.push(replacestring);
			string = string.substr(pos + searchstring.length);
		}
		return result.join("");
	},

	_me_strip: function(string, stripchars)
	{
		ul4._checkmethargs("strip", arguments.length, 1);
		if (typeof(string) !== "string")
			throw "strip() requires a string";
		if (typeof(stripchars) === "undefined")
			stripchars = " \r\n\t";
		else if (typeof(stripchars) !== "string")
			throw "strip() requires two strings";

		while (string && stripchars.indexOf(string[0]) >= 0)
			string = string.substr(1);
		while (string && stripchars.indexOf(string[string.length-1]) >= 0)
			string = string.substr(0, string.length-1);
		return string;
	},

	_me_lstrip: function(string, stripchars)
	{
		ul4._checkmethargs("lstrip", arguments.length, 1);
		if (typeof(string) !== "string")
			throw "lstrip() requires a string";
		if (typeof(stripchars) === "undefined")
			stripchars = " \r\n\t";
		else if (typeof(stripchars) !== "string")
			throw "lstrip() requires two strings";

		while (string && stripchars.indexOf(string[0]) >= 0)
			string = string.substr(1);
		return string;
	},

	_me_rstrip: function(string, stripchars)
	{
		ul4._checkmethargs("rstrip", arguments.length, 1);
		if (typeof(string) !== "string")
			throw "rstrip() requires a string";
		if (typeof(stripchars) === "undefined")
			stripchars = " \r\n\t";
		else if (typeof(stripchars) !== "string")
			throw "rstrip() requires two strings";

		while (string && stripchars.indexOf(string[string.length-1]) >= 0)
			string = string.substr(0, string.length-1);
		return string;
	},

	_me_split: function(string, sep, count)
	{
		ul4._checkmethargs("split", arguments.length, 0, 2);
		if (typeof(string) !== "string")
			throw "split() requires a string";
		if (typeof(sep) === "undefined")
			sep = null;
		else if (sep !== null && typeof(sep) !== "string")
			throw "split() requires a string";

		if (!count)
		{
			var result = string.split(sep !== null ? sep : /[ \n\r\t]+/);
			if (sep === null)
			{
				if (result.length && !result[0].length)
					result.splice(0, 1);
				if (result.length && !result[result.length-1].length)
					result.splice(-1);
			}
			return result;
		}
		else
		{
			if (sep !== null)
			{
				var result = [];
				while (string.length)
				{
					var pos = string.indexOf(sep);
					if (pos === -1 || !count--)
					{
						result.push(string);
						break;
					}
					result.push(string.substr(0, pos));
					string = string.substr(pos + sep.length);
				}
				return result;
			}
			else
			{
				var result = [];
				while (string.length)
				{
					string = this._me_lstrip(string);
					var part;
					if (!count--)
					 	part = string; // Take the rest of the string
					else
						part = string.split(/[ \n\r\t]+/, 1)[0];
					if (part.length)
						result.push(part);
					string = string.substr(part.length);
				}
				return result;
			}
		}
	},

	_me_rsplit: function(string, sep, count)
	{
		ul4._checkmethargs("rsplit", arguments.length, 0, 2);
		if (typeof(string) !== "string")
			throw "rsplit() requires a string as first argument";
		if (typeof(sep) === "undefined")
			sep = null;
		else if (sep !== null && typeof(sep) !== "string")
			throw "rsplit() requires a string as second argument";

		if (!count)
		{
			var result = string.split(sep !== null ? sep : /[ \n\r\t]+/);
			if (sep === null)
			{
				if (result.length && !result[0].length)
					result.splice(0, 1);
				if (result.length && !result[result.length-1].length)
					result.splice(-1);
			}
			return result;
		}
		else
		{
			if (sep !== null)
			{
				var result = [];
				while (string.length)
				{
					var pos = string.lastIndexOf(sep);
					if (pos === -1 || !count--)
					{
						result.unshift(string);
						break;
					}
					result.unshift(string.substr(pos+sep.length));
					string = string.substr(0, pos);
				}
				return result;
			}
			else
			{
				var result = [];
				while (string.length)
				{
					string = this._me_rstrip(string);
					var part;
					if (!count--)
					 	part = string; // Take the rest of the string
					else
					{
						part = string.split(/[ \n\r\t]+/);
						part = part[part.length-1];
					}
					if (part.length)
						result.unshift(part);
					string = string.substr(0, string.length-part.length);
				}
				return result;
			}
		}
	},

	_me_find: function(obj, search, start, stop)
	{
		ul4._checkmethargs("find", arguments.length, 1, 3);
		if (start < 0)
			start += obj.length;
		if (start < 0)
			start = 0;
		if (typeof(start) === "undefined" || start === null)
			start = 0;
		if (typeof(stop) === "undefined" || stop === null)
			stop = obj.length;

		if (start !== 0 || stop !== obj.length)
		{
			if (typeof(obj) == "string")
				obj = obj.substring(start, stop);
			else
				obj = obj.slice(start, stop);
		}
		var result = obj.indexOf(search);
		if (result !== -1)
			result += start;
		return result;
	},

	_me_rfind: function(obj, search, start, stop)
	{
		ul4._checkmethargs("rfind", arguments.length, 1, 3);
		if (start < 0)
			start += obj.length;
		if (start < 0)
			start = 0;
		if (typeof(start) === "undefined" || start === null)
			start = 0;
		if (typeof(stop) === "undefined" || stop === null)
			stop = obj.length;

		if (start !== 0 || stop !== obj.length)
		{
			if (typeof(obj) == "string")
				obj = obj.substring(start, stop);
			else
				obj = obj.slice(start, stop);
		}
		var result = obj.lastIndexOf(search);
		if (result !== -1)
			result += start;
		return result;
	},

	_me_lower: function(obj)
	{
		ul4._checkmethargs("lower", arguments.length, 0);
		if (typeof(obj) != "string")
			throw "lower() requires a string";

		return obj.toLowerCase();
	},

	_me_upper: function(obj)
	{
		ul4._checkmethargs("upper", arguments.length, 0);
		if (typeof(obj) != "string")
			throw "upper() requires a string";

		return obj.toUpperCase();
	},

	_me_capitalize: function(obj)
	{
		ul4._checkmethargs("capitalize", arguments.length, 0);
		if (typeof(obj) != "string")
			throw "capitalize() requires a string";

		if (obj.length)
			obj = obj[0].toUpperCase() + obj.slice(1).toLowerCase();
		return obj;
	},

	_me_get: function(container, key, defaultvalue)
	{
		ul4._checkmethargs("get", arguments.length, 1, 2);
		if (!this._fu_isdict(container))
			throw "get() requires a dict";

		var result = container[key];
		if (typeof(result) === "undefined")
		{
			if (typeof(defaultvalue) === "undefined")
				return null;
			return defaultvalue;
		}
		return result;
	},

	_me_items: function(obj)
	{
		ul4._checkmethargs("items", arguments.length, 0);
		if (!this._fu_isdict(obj))
			throw "items() requires a dict";

		var result = [];
		for (var key in obj)
			result.push([key, obj[key]]);
		return result;
	},

	_me_values: function(obj)
	{
		ul4._checkmethargs("values", arguments.length, 0);
		if (!this._fu_isdict(obj))
			throw "values() requires a dict";

		var result = [];
		for (var key in obj)
			result.push(obj[key]);
		return result;
	},

	_me_join: function(sep, container)
	{
		ul4._checkmethargs("join", arguments.length, 1);
		if (typeof(sep) !== "string")
			throw "join() requires a string";

		var resultlist = [];
		for (var iter = ul4._iter(container);;)
		{
			var item = iter();
			if (item === null)
				break;
			resultlist.push(item[0]);
		}
		return resultlist.join(sep);
	},

	_me_startswith: function(string, prefix)
	{
		ul4._checkmethargs("startswith", arguments.length, 1);
		if (typeof(string) !== "string" || typeof(prefix) !== "string")
			throw "startswith() requires two strings";

		return string.substr(0, prefix.length) === prefix;
	},

	_me_endswith: function(string, suffix)
	{
		ul4._checkmethargs("endswith", arguments.length, 1);
		if (typeof(string) !== "string" || typeof(suffix) !== "string")
			throw "endswith() requires two strings";

		return string.substr(string.length-suffix.length) === suffix;
	},

	_me_isoformat: function(obj)
	{
		ul4._checkmethargs("isoformat", arguments.length, 0);
		if (!this._fu_isdate(obj))
			throw "isoformat() requires a date";

		var result = obj.getFullYear() + "-" + this._lpad((obj.getMonth()+1).toString(), "0", 2) + "-" + this._lpad(obj.getDate().toString(), "0", 2);
		var hour = obj.getHours();
		var minute = obj.getMinutes();
		var second = obj.getSeconds();
		var ms = obj.getMilliseconds();
		if (hour || minute || second || ms)
		{
			result += "T" + this._lpad(hour.toString(), "0", 2) + ":" + this._lpad(minute.toString(), "0", 2) + ":" + this._lpad(second.toString(), "0", 2);
			if (ms)
				result += "." + this._lpad(ms.toString(), "0", 3) + "000";
		}
		return result;
	},

	_me_mimeformat: function(obj)
	{
		ul4._checkmethargs("mimeformat", arguments.length, 0);
		if (!this._fu_isdate(obj))
			throw "mimeformat() requires a date";

		var weekdayname = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
		var monthname = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

		return weekdayname[this._me_weekday(obj)] + ", " + this._lpad(obj.getDate(), "0", 2) + " " + monthname[obj.getMonth()] + " " + obj.getFullYear() + " " + this._lpad(obj.getHours(), "0", 2) + ":" + this._lpad(obj.getMinutes(), "0", 2) + ":" + this._lpad(obj.getSeconds(), "0", 2) + " GMT";
	},

	_me_year: function(obj)
	{
		ul4._checkmethargs("year", arguments, 0);
		if (!this._fu_isdate(obj))
			throw "year() requires a date";

		return obj.getFullYear();
	},

	_me_month: function(obj)
	{
		ul4._checkmethargs("month", arguments, 0);
		if (!this._fu_isdate(obj))
			throw "month() requires a date";

		return obj.getMonth()+1;
	},

	_me_day: function(obj)
	{
		ul4._checkmethargs("day", arguments, 0);
		if (!this._fu_isdate(obj))
			throw "day() requires a date";

		return obj.getDate();
	},

	_me_hour: function(obj)
	{
		ul4._checkmethargs("hour", arguments, 0);
		if (!this._fu_isdate(obj))
			throw "hour() requires a date";

		return obj.getHours();
	},

	_me_minute: function(obj)
	{
		ul4._checkmethargs("mimute", arguments, 0);
		if (!this._fu_isdate(obj))
			throw "minute() requires a date";

		return obj.getMinutes();
	},

	_me_second: function(obj)
	{
		ul4._checkmethargs("second", arguments, 0);
		if (!this._fu_isdate(obj))
			throw "second() requires a date";

		return obj.getSeconds();
	},

	_me_microsecond: function(obj)
	{
		ul4._checkmethargs("microsecond", arguments, 0);
		if (!this._fu_isdate(obj))
			throw "micosecond() requires a date";

		return obj.getMilliseconds() * 1000;
	},

	_me_weekday: function(obj)
	{
		ul4._checkmethargs("weekday", arguments, 0);
		if (!this._fu_isdate(obj))
			throw "weekday() requires a date";

		var d = obj.getDay();
		return d ? d-1 : 6;
	},

	_me_week: function(obj, firstweekday)
	{
		if (typeof(firstweekday) === "undefined" || firstweekday === null)
			firstweekday = 0;
		else
			firstweekday %= 7;

		var yearday = ul4._me_yearday(obj)+6;
		var jan1 = new Date(obj.getFullYear(), 0, 1);
		var jan1weekday = jan1.getDay();
		if (--jan1weekday < 0)
			jan1weekday = 6;

		while (jan1weekday != firstweekday)
		{
			--yearday;
			if (++jan1weekday == 7)
				jan1weekday = 0;
		}
		return Math.floor(yearday/7);
	},

	_isleap: function(obj)
	{
		ul4._checkmethargs("isleap", arguments, 0);
		if (!this._fu_isdate(obj))
			throw "isleap() requires a date";

		return new Date(obj.getFullYear(), 1, 29).getMonth() === 1;
	},

	_me_yearday: function(obj)
	{
		ul4._checkmethargs("yearday", arguments, 0);
		if (!this._fu_isdate(obj))
			throw "yearday() requires a date";

		var leap = this._isleap(obj) ? 1 : 0;
		var day = obj.getDate();
		switch (obj.getMonth())
		{
			case 0:
				return day;
			case 1:
				return 31 + day;
			case 2:
				return 31 + 28 + leap + day;
			case 3:
				return 31 + 28 + leap + 31 + day;
			case 4:
				return 31 + 28 + leap + 31 + 30 + day;
			case 5:
				return 31 + 28 + leap + 31 + 30 + 31 + day;
			case 6:
				return 31 + 28 + leap + 31 + 30 + 31 + 30 + day;
			case 7:
				return 31 + 28 + leap + 31 + 30 + 31 + 30 + 31 + day;
			case 8:
				return 31 + 28 + leap + 31 + 30 + 31 + 30 + 31 + 31 + day;
			case 9:
				return 31 + 28 + leap + 31 + 30 + 31 + 30 + 31 + 31 + 30 + day;
			case 10:
				return 31 + 28 + leap + 31 + 30 + 31 + 30 + 31 + 31 + 30 + 31 + day;
			case 11:
				return 31 + 28 + leap + 31 + 30 + 31 + 30 + 31 + 31 + 30 + 31 + 30 + day;
		}
	},

	_me_renders: function(obj)
	{
		ul4._checkmethargs("renders", arguments, 0);
		return obj.renders({});
	},

	// Color methods
	_me_r: function(obj)
	{
		ul4._checkmethargs("r", arguments, 0);
		if (!this._fu_iscolor(obj))
			throw "r() requires a color";

		return obj.r;
	},

	_me_g: function(obj)
	{
		ul4._checkmethargs("g", arguments, 0);
		if (!this._fu_iscolor(obj))
			throw "g() requires a color";

		return obj.g;
	},

	_me_b: function(obj)
	{
		ul4._checkmethargs("b", arguments, 0);
		if (!this._fu_iscolor(obj))
			throw "b() requires a color";

		return obj.b;
	},

	_me_a: function(obj)
	{
		ul4._checkmethargs("a", arguments, 0);
		if (!this._fu_iscolor(obj))
			throw "a() requires a color";

		return obj.a;
	},

	_me_lum: function(obj)
	{
		ul4._checkmethargs("lum", arguments, 0);
		if (!this._fu_iscolor(obj))
			throw "lum() requires a color";

		return obj.lum();
	},

	_me_hls: function(obj)
	{
		ul4._checkmethargs("hls", arguments, 0);
		if (!this._fu_iscolor(obj))
			throw "hls() requires a color";

		return obj.hls();
	},

	_me_hlsa: function(obj)
	{
		ul4._checkmethargs("hlsa", arguments, 0);
		if (!this._fu_iscolor(obj))
			throw "hlsa() requires a color";

		return obj.hlsa();
	},

	_me_hsv: function(obj)
	{
		ul4._checkmethargs("hsv", arguments, 0);
		if (!this._fu_iscolor(obj))
			throw "hsv() requires a color";

		return obj.hsv();
	},

	_me_hsva: function(obj)
	{
		ul4._checkmethargs("hsva", arguments, 0);
		if (!this._fu_iscolor(obj))
			throw "hsva() requires a color";

		return obj.hsva();
	},

	_me_witha: function(obj, newa)
	{
		ul4._checkmethargs("witha", arguments, 1);
		if (!this._fu_iscolor(obj))
			throw "witha() requires a color";

		return obj.witha(newa);
	},

	_me_withlum: function(obj, newlum)
	{
		ul4._checkmethargs("withlum", arguments, 1);
		if (!this._fu_iscolor(obj))
			throw "withlum() requires a color";

		return obj.withlum(newlum);
	},

	/// Helper functions

	// Crockford style object creation
	_clone: function(obj)
	{
		function F(){};
		F.prototype = obj;
		var result = new F();
		result.__prototype__ = obj;
		result.__id__ = ul4.Proto._nextid++;
		return result;
	},

	// Clone an object and extend it
	_inherit: function(baseobj, attrs)
	{
		var newobj = ul4._clone(baseobj);
		attrs = attrs || {};
		for (var name in attrs)
			newobj[name] = attrs[name];
		return newobj;
	},

	// Return an iterator for ``obj``
	_iter: function(obj)
	{
		if (typeof(obj) === "string" || this._fu_islist(obj))
		{
			var i = 0;
			var result = function()
			{
				return (i < obj.length) ? [obj[i++]] : null;
			};
			return ul4._markiter(result);
		}
		else if (this._fu_isdict(obj))
		{
			var keys = [];
			for (var key in obj)
				keys.push(key);
			var i = 0;
			var result = function()
			{
				if (i >= keys.length)
					return null;
				return [keys[i++]];
			};
			return ul4._markiter(result);
		}
		else if (obj !== null && obj !== undefined && typeof(obj.__iter__) !== "undefined")
		{
			return obj;
		}
		throw "'" + this._fu_type(obj) + "' object is not iterable";
	},

	// Mark a function as an iterator
	_markiter: function(f)
	{
		f.__iter__ = true;
		return f;
	},

	formatnestedname: function(varname)
	{
		if (typeof(varname) === "string")
			return varname;
		else if (varname.length == 1)
			return "(" + this.formatnestedname(varname[0]) + ",)";
		else
		{
			var v = [];
			v.push("(");
			for (var i in varname)
			{
				if (i)
					v.push(", ");
				v.push(formatnestedname(varname[i]));
			}
			v.push(")");
			return v.join("");
		}
	},

	_unpackvariable: function(vars, varname, item)
	{
		if (typeof(varname) === "string")
			vars[varname] = item;
		else
		{
			var iter = this._iter(item);

			for (var i = 0;;++i)
			{
				var nextitem = iter();

				if (nextitem !== null)
				{
					if (i < varname.length)
						this._unpackvariable(vars, varname[i], nextitem[0]);
					else
						throw "mismatched variable unpacking: " + varname.length + " varnames, >" + i + " items";
				}
				else
				{
					if (i === varname.length)
						break;
					else
						throw "mismatched variable unpacking: " + varname.length + " varnames, " + (i+1) + " items";
				}
			}
		}
	},

	// Repeat string ``str`` ``rep`` times
	_str_repeat: function(str, rep)
	{
		var result = "";
		for (; rep>0; --rep)
			result += str;
		return result;
	},

	_list_repeat: function(list, rep)
	{
		var result = [];
		for (; rep>0; --rep)
			for (var i in list)
				result.push(list[i]);
		return result;
	},

	_date_repr: function(obj)
	{
		var year = obj.getFullYear();
		var month = obj.getMonth()+1;
		var day = obj.getDate();
		var hour = obj.getHours();
		var minute = obj.getMinutes();
		var second = obj.getSeconds();
		var ms = obj.getMilliseconds();
		var result = "@(" + year + "-" + this._lpad(month.toString(), "0", 2) + "-" + this._lpad(day.toString(), "0", 2);

		if (hour || minute || second || ms)
		{
			result += "T" + this._lpad(hour.toString(), "0", 2) + ":" + this._lpad(minute.toString(), "0", 2) + ":" + this._lpad(second.toString(), "0", 2);
			if (ms)
				result += "." + this._lpad(ms.toString(), "0", 3) + "000";
		}
		result += ")";

		return result;
	},

	_date_str: function(obj)
	{
		var year = obj.getFullYear();
		var month = obj.getMonth()+1;
		var day = obj.getDate();
		var hour = obj.getHours();
		var minute = obj.getMinutes();
		var second = obj.getSeconds();
		var ms = obj.getMilliseconds();

		var result = year + "-" + this._lpad(month.toString(), "0", 2) + "-" + this._lpad(day.toString(), "0", 2) + " " + this._lpad(hour.toString(), "0", 2) + ":" + this._lpad(minute.toString(), "0", 2) + ":" + this._lpad(second.toString(), "0", 2);
		if (ms)
			result += "." + this._lpad(ms.toString(), "0", 3) + "000";
		return result;
	},

	_str_json: function(str)
	{
		var result = "";
		for (var i in str)
		{
			var c = str[i];
			switch (c)
			{
				case "\r":
					result += "\\r";
					break;
				case "\n":
					result += "\\n";
					break;
				case "\t":
					result += "\\t";
					break;
				case "\\":
					result += "\\\\";
					break;
				case '"':
					result += '\\"';
					break;
				default:
					var code = str.charCodeAt(i);
					if (code >= 32 && code < 128)
						result += c;
					else
						result += "\\u" + this._lpad(code.toString(16), "0", 4);
					break;
			}
		}
		return '"' + result + '"';
	},

	_str_repr: function(str)
	{
		var result = "";
		for (var i in str)
		{
			var c = str[i];
			switch (c)
			{
				case "\r":
					result += "\\r";
					break;
				case "\n":
					result += "\\n";
					break;
				case "\t":
					result += "\\t";
					break;
				case '"':
					result += '\\"';
					break;
				default:
					var code = str.charCodeAt(i);
					if (code >= 32 && code < 128)
						result += c;
					else
					{
						var prefix, length;
						if (code <= 0xFF)
						{
							prefix = "\\x";
							length = 2;
						}
						else if (code <= 0xFFFF)
						{
							prefix = "\\u";
							length = 4;
						}
						else
						{
							prefix = "\\U";
							length = 8;
						}
						result += prefix + this._lpad(code.toString(16), "0", length);
					}
					break;
			}
		}
		return '"' + result + '"';
	},

	_makedict: function()
	{
		var result = {};
		for (var i in arguments)
		{
			var item = arguments[i];
			if (item.length == 2)
				result[item[0]] = item[1];
			else
			{
				for (var key in item[0])
					result[key] = item[0][key];
			}
		}
		return result;
	},

	_lpad: function(string, pad, len)
	{
		if (typeof(string) === "number")
			string = string.toString();
		while (string.length < len)
			string = pad + string;
		return string;
	},

	_rpad: function(string, pad, len)
	{
		if (typeof(string) === "number")
			string = string.toString();
		while (string.length < len)
			string = string + pad;
		return string;
	},

	_checkfuncargs: function(funcname, args, min, max)
	{
		if (typeof(max) === "undefined")
			max = min;
		if (args.length < min || (max !== null && args.length > max))
		{
			if (min == max)
				throw "function " + funcname + "() requires " + min + " argument" + (min!==1 ? "s" : "") + ", " + args.length + " given";
			else if (max !== null)
				throw "function " + funcname + "() requires " + min + "-" + max + " arguments, " + args.length + " given";
			else
				throw "function " + funcname + "() requires at least " + min + " argument" + (min!==1 ? "s" : "") + ", " + args.length + " given";
		}
	},

	_checkmethargs: function(methname, args, min, max)
	{
		if (typeof(max) === "undefined")
			max = min;
		if ((args.length-1) < min || (args.length-1) > max)
		{
			if (min == max)
				throw "method " + methname + "() requires " + min + " argument" + (min!==1 ? "s" : "") + ", " + (args.length-1) + " given";
			else
				throw "method " + methname + "() requires " + min + "-" + max + " arguments, " + (args.length-1) + " given";
		}
	}
};

ul4.Proto = {
	__prototype__: null,
	__id__: 0,
	_nextid: 1,
	isa: function(type)
	{
		if (this === type)
			return true;
		if (this.__prototype__ === null)
			return false;
		return this.__prototype__.isa(type);
	},

	// To support comparison you only have to implement ``__eq__`` and ``__lt__``

	__ne__: function(other)
	{
		return !this.__eq__(other);
	},

	__le__: function(other)
	{
		return this.__eq__(other) || this.__lt__(other);
	},

	__gt__: function(other)
	{
		return !this.__eq__(other) && !this.__lt__(other);
	},

	__ge__: function(other)
	{
		return !this.__lt__(other);
	},

	__bool__: function()
	{
		return true;
	}
};

ul4.Color = ul4._inherit(
	ul4.Proto,
	{
		__type__: "color",

		create: function(r, g, b, a)
		{
			var c = ul4._clone(this);
			c.r = typeof(r) !== "undefined" ? r : 0;
			c.g = typeof(g) !== "undefined" ? g : 0;
			c.b = typeof(b) !== "undefined" ? b : 0;
			c.a = typeof(a) !== "undefined" ? a : 255;
			return c;
		},

		__repr__: function()
		{
			var r = ul4._lpad(this.r.toString(16), "0", 2);
			var g = ul4._lpad(this.g.toString(16), "0", 2);
			var b = ul4._lpad(this.b.toString(16), "0", 2);
			var a = ul4._lpad(this.a.toString(16), "0", 2);
			if (this.a !== 0xff)
			{
				if (r[0] === r[1] && g[0] === g[1] && b[0] === b[1] && a[0] === a[1])
					return "#" + r[0] + g[0] + b[0] + a[0];
				else
					return "#" + r + g + b + a;
			}
			else
			{
				if (r[0] === r[1] && g[0] === g[1] && b[0] === b[1])
					return "#" + r[0] + g[0] + b[0];
				else
					return "#" + r + g + b;
			}
		},

		__str__: function()
		{
			if (this.a !== 0xff)
			{
				return "rgba(" + this.r + ", " + this.g + ", " + this.b + ", " + (this.a/255) + ")";
			}
			else
			{
				var r = ul4._lpad(this.r.toString(16), "0", 2);
				var g = ul4._lpad(this.g.toString(16), "0", 2);
				var b = ul4._lpad(this.b.toString(16), "0", 2);
				var a = ul4._lpad(this.a.toString(16), "0", 2);
				if (r[0] === r[1] && g[0] === g[1] && b[0] === b[1])
					return "#" + r[0] + g[0] + b[0];
				else
					return "#" + r + g + b;
			}
		},

		__getitem__: function(key)
		{
			var orgkey = key;
			if (key < 0)
				key += 4;
			switch (key)
			{
				case 0:
					return this.r;
				case 1:
					return this.g;
				case 2:
					return this.b;
				case 3:
					return this.a;
				default:
					return undefined;
			}
		},

		lum: function()
		{
			return this.hls()[1];
		},

		hls: function()
		{
			var r = this.r/255.0;
			var g = this.g/255.0;
			var b = this.b/255.0;
			var maxc = Math.max(r, g, b);
			var minc = Math.min(r, g, b);
			var h, l, s;
			var rc, gc, bc;

			l = (minc+maxc)/2.0;
			if (minc == maxc)
				return [0.0, l, 0.0];
			if (l <= 0.5)
				s = (maxc-minc) / (maxc+minc);
			else
				s = (maxc-minc) / (2.0-maxc-minc);
			rc = (maxc-r) / (maxc-minc);
			gc = (maxc-g) / (maxc-minc);
			bc = (maxc-b) / (maxc-minc);
			if (r == maxc)
				h = bc-gc;
			else if (g == maxc)
				h = 2.0+rc-bc;
			else
				h = 4.0+gc-rc;
			h = (h/6.0) % 1.0;
			return [h, l, s];
		},

		hlsa: function()
		{
			var hls = this.hls();
			return hls.concat(this.a/255.0);
		},

		hsv: function()
		{
			var r = this.r/255.0;
			var g = this.g/255.0;
			var b = this.b/255.0;
			var maxc = Math.max(r, g, b);
			var minc = Math.min(r, g, b);
			var v = maxc;
			if (minc == maxc)
				return [0.0, 0.0, v];
			var s = (maxc-minc) / maxc;
			var rc = (maxc-r) / (maxc-minc);
			var gc = (maxc-g) / (maxc-minc);
			var bc = (maxc-b) / (maxc-minc);
			var h;
			if (r == maxc)
				h = bc-gc;
			else if (g == maxc)
				h = 2.0+rc-bc;
			else
				h = 4.0+gc-rc;
			h = (h/6.0) % 1.0;
			return [h, s, v];
		},

		hsva: function()
		{
			var hsv = this.hsv();
			return hsv.concat(this.a/255.0);
		},

		witha: function(a)
		{
			if (typeof(a) !== "number")
				throw "witha() requires a number";
			return ul4.Color.create(this.r, this.g, this.b, a);
		},

		withlum: function(lum)
		{
			if (typeof(lum) !== "number")
				throw "witha() requires a number";
			var hlsa = this.hlsa();
			return ul4._fu_hls(hlsa[0], lum, hlsa[2], hlsa[3]);
		}
	}
);

ul4.TimeDelta = ul4._inherit(
	ul4.Proto,
	{
		__type__: "timedelta",

		create: function(days, seconds, microseconds)
		{
			var td = ul4._clone(this);
			if (typeof(days) === "undefined")
				days = 0;
			if (typeof(seconds) === "undefined")
				seconds = 0;
			if (typeof(microseconds) === "undefined")
				microseconds = 0;

			var total_microseconds = Math.floor((days * 86400 + seconds)*1000000 + microseconds);

			microseconds = ul4._op_mod(total_microseconds, 1000000);
			var total_seconds = Math.floor(total_microseconds / 1000000);
			seconds = ul4._op_mod(total_seconds, 86400);
			days = Math.floor(total_seconds / 86400);
			if (seconds < 0)
			{
				seconds += 86400;
				--days;
			}

			td.microseconds = microseconds;
			td.seconds = seconds;
			td.days = days;

			return td;
		},

		__repr__: function()
		{
			if (!this.microseconds)
			{
				if (!this.seconds)
				{
					if (!this.days)
						return "timedelta()";
					return "timedelta(" + this.days + ")";
				}
				return "timedelta(" + this.days + ", " + this.seconds + ")";
			}
			return "timedelta(" + this.days + ", " + this.seconds + ", " + this.microseconds + ")";
		},

		__str__: function()
		{
			var v = [];
			if (this.days)
			{
				v.push(this.days + " day");
				if (this.days !== -1 && this.days !== 1)
					v.push("s");
				v.push(", ");
			}
			var seconds = this.seconds % 60;
			var minutes = Math.floor(this.seconds / 60);
			var hours = Math.floor(minutes / 60);
			minutes = minutes % 60;

			v.push("" + hours);
			v.push(":");
			v.push(ul4._lpad(minutes.toString(), "0", 2));
			v.push(":");
			v.push(ul4._lpad(seconds.toString(), "0", 2));
			if (this.microseconds)
			{
				v.push(".");
				v.push(ul4._lpad(this.microseconds.toString(), "0", 6));
			}
			return v.join("");
		},

		__bool__: function()
		{
			return this.days !== 0 || this.seconds !== 0 || this.microseconds !== 0;
		},

		__eq__: function(other)
		{
			if (ul4._fu_istimedelta(other))
				return (this.days === other.days) && (this.seconds === other.seconds) && (this.microseconds === other.microseconds);
			return false;
		},

		__lt__: function(other)
		{
			if (ul4._fu_istimedelta(other))
			{
				if (this.days < other.days)
					return true;
				if (this.days > other.days)
					return false;
				if (this.seconds < other.seconds)
					return true;
				if (this.seconds > other.seconds)
					return false;
				return this.microseconds < other.microseconds;
			}
			throw "unorderable types: " + ul4._fu_type(this) + "() >=< " + ul4._fu_type(other) + "()";
		},

		__neg__: function()
		{
			return ul4.TimeDelta.create(-this.days, -this.seconds, -this.microseconds);
		},

		_add: function(date, days, seconds, microseconds)
		{
			var year = date.getFullYear();
			var month = date.getMonth();
			var day = date.getDate() + days;
			var hour = date.getHours();
			var minute = date.getMinutes();
			var second = date.getSeconds() + seconds;
			var millisecond = date.getMilliseconds() + microseconds/1000;
			return new Date(year, month, day, hour, minute, second, millisecond);
		},

		__add__: function(other)
		{
			if (ul4._fu_istimedelta(other))
				return ul4.TimeDelta.create(this.days + other.days, this.seconds + other.seconds, this.microseconds + other.microseconds);
			else if (ul4._fu_isdate(other))
				return this._add(other, this.days, this.seconds, this.microseconds);
			throw ul._fu_type(this) + " + " + this._fu_type(other) + " not supported";
		},

		__radd__: function(other)
		{
			if (ul4._fu_isdate(other))
				return this._add(other, this.days, this.seconds, this.microseconds);
			throw ul._fu_type(this) + " + " + this._fu_type(other) + " not supported";
		},

		__sub__: function(other)
		{
			if (ul4._fu_istimedelta(other))
				return ul4.TimeDelta.create(this.days - other.days, this.seconds - other.seconds, this.microseconds - other.microseconds);
			throw ul._fu_type(this) + " - " + this._fu_type(other) + " not supported";
		},

		__rsub__: function(other)
		{
			if (ul4._fu_isdate(other))
				return this._add(other, -this.days, -this.seconds, -this.microseconds);
			throw ul._fu_type(this) + " - " + this._fu_type(other) + " not supported";
		},

		__mul__: function(other)
		{
			if (typeof(other) === "number")
			{
				return ul4.TimeDelta.create(this.days * other, this.seconds * other, this.microseconds * other);
			}
			throw ul._fu_type(this) + " * " + this._fu_type(other) + " not supported";
		},

		__rmul__: function(other)
		{
			if (typeof(other) === "number")
			{
				return ul4.TimeDelta.create(this.days * other, this.seconds * other, this.microseconds * other);
			}
			throw ul._fu_type(this) + " * " + this._fu_type(other) + " not supported";
		},

		__truediv__: function(other)
		{
			if (typeof(other) === "number")
			{
				return ul4.TimeDelta.create(this.days / other, this.seconds / other, this.microseconds / other);
			}
			throw ul._fu_type(this) + " / " + this._fu_type(other) + " not supported";
		}
	}
);

ul4.MonthDelta = ul4._inherit(
	ul4.Proto,
	{
		__type__: "monthdelta",

		create: function(months)
		{
			var md = ul4._clone(this);
			md.months = typeof(months) !== "undefined" ? months : 0;
			return md;
		},

		__repr__: function()
		{
			if (!this.months)
				return "monthdelta()";
			return "monthdelta(" + this.months + ")";
		},

		__str__: function()
		{
			if (this.months)
			{
				if (this.months !== -1 && this.months !== 1)
					return this.months + " months";
				return this.months + " month";
			}
			return "0 months";
		},

		__bool__: function()
		{
			return this.months !== 0;
		},

		__eq__: function(other)
		{
			if (ul4._fu_ismonthdelta(other))
				return this.months === other.months;
			return false;
		},

		__lt__: function(other)
		{
			if (ul4._fu_ismonthdelta(other))
				return this.months < other.months;
			throw "unorderable types: " + ul4._fu_type(this) + "() >=< " + ul4._fu_type(other) + "()";
		},

		__neg__: function()
		{
			return ul4.MonthDelta.create(-this.months);
		},

		_add: function(date, months)
		{
			var year = date.getFullYear();
			var month = date.getMonth() + months;
			var day = date.getDate();
			var hour = date.getHours();
			var minute = date.getMinutes();
			var second = date.getSeconds();
			var millisecond = date.getMilliseconds();

			while (true)
			{
				// As the month might be out of bounds, we have to find out, what the real target month is
				var targetmonth = new Date(year, month, 1, hour, minute, second, millisecond).getMonth();
				var result = new Date(year, month, day, hour, minute, second, millisecond);
				if (result.getMonth() === targetmonth)
					return result;
				--day;
			}
		},

		__add__: function(other)
		{
			if (ul4._fu_ismonthdelta(other))
				return ul4.MonthDelta.create(this.months + other.months);
			else if (ul4._fu_isdate(other))
				return this._add(other, this.months);
			throw ul._fu_type(this) + " + " + this._fu_type(other) + " not supported";
		},

		__radd__: function(other)
		{
			if (ul4._fu_isdate(other))
				return this._add(other, this.months);
			throw ul._fu_type(this) + " + " + this._fu_type(other) + " not supported";
		},

		__sub__: function(other)
		{
			if (ul4._fu_ismonthdelta(other))
				return ul4.MonthDelta.create(this.months - other.months);
			throw ul._fu_type(this) + " - " + this._fu_type(other) + " not supported";
		},

		__rsub__: function(other)
		{
			if (ul4._fu_isdate(other))
				return this._add(other, -this.months);
			throw ul._fu_type(this) + " - " + this._fu_type(other) + " not supported";
		},

		__mul__: function(other)
		{
			if (typeof(other) === "number")
				return ul4.MonthDelta.create(this.months * Math.floor(other));
			throw ul._fu_type(this) + " * " + this._fu_type(other) + " not supported";
		},

		__rmul__: function(other)
		{
			if (typeof(other) === "number")
				return ul4.MonthDelta.create(this.months * Math.floor(other));
			throw ul._fu_type(this) + " * " + this._fu_type(other) + " not supported";
		},

		__floordiv__: function(other)
		{
			if (typeof(other) === "number")
				return ul4.MonthDelta.create(Math.floor(this.months / other));
			throw ul._fu_type(this) + " / " + this._fu_type(other) + " not supported";
		}
	}
);

ul4.Location = ul4._inherit(
	ul4.Proto,
	{
		create: function(source, type, starttag, endtag, startcode, endcode)
		{
			var location = ul4._clone(this);
			location.source = source;
			location.type = type;
			location.starttag = starttag;
			location.endtag = endtag;
			location.startcode = startcode;
			location.endcode = endcode;
			// Unfortunately Javascript doesn't have what other languages call properties, so we must create real attributes here
			if (typeof(source) != "undefined")
			{
				location.tag = source.substring(starttag, endtag);
				location.code = source.substring(startcode, endcode);
			}
			else
			{
				location.tag = null;
				location.code = null;
			}
			return location;
		},
		ul4ondump: function(encoder)
		{
			encoder.dump(this.source);
			encoder.dump(this.type);
			encoder.dump(this.starttag);
			encoder.dump(this.endtag);
			encoder.dump(this.startcode);
			encoder.dump(this.endcode);
		},
		ul4onload: function(decoder)
		{
			this.source = decoder.load();
			this.type = decoder.load();
			this.starttag = decoder.load();
			this.endtag = decoder.load();
			this.startcode = decoder.load();
			this.endcode = decoder.load();

			this.tag = this.source.substring(this.starttag, this.endtag);
			this.code = this.source.substring(this.startcode, this.endcode);
		}
	}
);

ul4.AST = ul4._inherit(
	ul4.Proto,
	{
		create: function(location)
		{
			var ast = ul4._clone(this);
			ast.location = location;
			return ast;
		},
		_name: function()
		{
			var name = this.ul4onname.split(".");
			return name[name.length-1];
		},
		_line: function(indent, line)
		{
			return ul4._op_mul("\t", indent) + line + "\n";
		},
		_formatop: function(op)
		{
			if (op.precedence < this.precedence)
				return "(" + op.format(0) + ")";
			else if (op.precedence === this.precedence && (op.ul4onname !== this.ul4onname || !this.associative))
				return "(" + op.format(0) + ")";
			else
				return op.format(0);
		},
		_add2template: function(template)
		{
			template._asts[this.__id__] = this;
		},
		toString: function()
		{
			return this.format(0);
		},
		ul4ondump: function(encoder)
		{
			for (var i in this._ul4onattrs)
				encoder.dump(this[this._ul4onattrs[i]]);
		},
		ul4onload: function(decoder)
		{
			for (var i in this._ul4onattrs)
				this[this._ul4onattrs[i]] = decoder.load();
		},
		// used in ``format``/``_formatop`` to decide if we need brackets around an operator
		precedence: null,
		associative: true,
		// used in ul4ondump/ul4ondump to automatically dump these attributes
		_ul4onattrs: ["location"]
	}
);

ul4.Text = ul4._inherit(
	ul4.AST,
	{
		text: function()
		{
			return this.location.source.substring(this.location.startcode, this.location.endcode);
		},
		formatjs: function(indent)
		{
			return this._line(indent, "out.push(" + ul4._fu_asjson(this.text()) + ");");
		},
		format: function(indent)
		{
			return this._line(indent, "text " + ul4._fu_repr(this.text()));
		}
	}
);

ul4.LoadNone = ul4._inherit(
	ul4.AST,
	{
		formatjs: function(indent)
		{
			return "null";
		},
		format: function(indent)
		{
			return "None";
		},
		precedence: 11
	}
);

ul4.LoadTrue = ul4._inherit(
	ul4.AST,
	{
		formatjs: function(indent)
		{
			return "true";
		},
		format: function(indent)
		{
			return "True";
		},
		precedence: 11
	}
);

ul4.LoadFalse = ul4._inherit(
	ul4.AST,
	{
		formatjs: function(indent)
		{
			return "false";
		},
		format: function(indent)
		{
			return "False";
		},
		precedence: 11
	}
);

ul4.Const = ul4._inherit(
	ul4.AST,
	{
		create: function(location, value)
		{
			var constant = ul4.AST.create.call(this, location);
			constant.value = value;
			return constant;
		},
		_ul4onattrs: ul4.AST._ul4onattrs.concat(["value"]),
		formatjs: function(indent)
		{
			return ul4._fu_asjson(this.value);
		},
		format: function(indent)
		{
			return ul4._fu_repr(this.value);
		},
		precedence: 11
	}
);

ul4.List = ul4._inherit(
	ul4.AST,
	{
		create: function(location)
		{
			var list = ul4.AST.create.call(this, location);
			list.items = [];
			return list;
		},
		_ul4onattrs: ul4.AST._ul4onattrs.concat(["items"]),
		formatjs: function(indent)
		{
			var v = [];
			for (var i in this.items)
				v.push(this.items[i].formatjs(indent));
			return "[" + v.join(", ") + "]";
		},
		format: function(indent)
		{
			var v = [];
			for (var i in this.items)
				v.push(this.items[i].format(indent));
			return "[" + v.join(", ") + "]";
		},
		precedence: 11
	}
);

ul4.ListComp = ul4._inherit(
	ul4.AST,
	{
		create: function(location, item, varname, container, condition)
		{
			var listcomp = ul4.AST.create.call(this, location);
			listcomp.item = item;
			listcomp.varname = varname;
			listcomp.container = container;
			listcomp.condition = condition;
			return listcomp;
		},
		_ul4onattrs: ul4.AST._ul4onattrs.concat(["item", "varname", "container", "condition"]),
		formatjs: function(indent)
		{
			var result = "(function(){var result=[];for(var iter=ul4._iter(" + this.container.formatjs(indent) + ");;){var item=iter();if(item===null)break;";
			result += "ul4._unpackvariable(vars, " + ul4._fu_asjson(this.varname) + ", item[0]);";
			if (this.condition !== null)
				result += "if(ul4._fu_bool(" + this.condition.formatjs(indent) + "))";
			result += "result.push(" + this.item.formatjs(indent) + ");}return result;})()"
			return result;
		},
		format: function(indent)
		{
			return "[ " + this.item.format(indent) + " for " + ul4.formatnestedname(this.varname) + " in " + this.container.format(indent) + (this.condition !== null ? " if " + this.condition.format(indent) : "") + " ]";
		},
		precedence: 11
	}
);

ul4.Dict = ul4._inherit(
	ul4.AST,
	{
		create: function(location)
		{
			var dict = ul4.AST.create.call(this, location);
			dict.items = [];
			return dict;
		},
		_ul4onattrs: ul4.AST._ul4onattrs.concat(["items"]),
		formatjs: function(indent)
		{
			var v = [];
			for (var i in this.items)
			{
				var item = this.items[i];
				if (item.length == 2)
					v.push("[" + item[0].formatjs(indent) + ", " + item[1].formatjs(indent) + "]");
				else
					v.push("[" + item[0].formatjs(indent) + "]");
			}
			return "ul4._makedict(" + v.join(", ") + ")";
		},
		format: function(indent)
		{
			var v = [];
			for (var i in this.items)
			{
				var item = this.items[i];
				if (item.length == 2)
					v.push(item[0].format(indent) + ": " + item[1].format(indent));
				else
					v.push("**" + item[0].format(indent));
			}
			return "{" + v.join(", ") + "}";
		},
		precedence: 11
	}
);

ul4.DictComp = ul4._inherit(
	ul4.AST,
	{
		create: function(location, key, value, varname, container, condition)
		{
			var listcomp = ul4.AST.create.call(this, location);
			listcomp.key = key;
			listcomp.value = value;
			listcomp.varname = varname;
			listcomp.container = container;
			listcomp.condition = condition;
			return listcomp;
		},
		_ul4onattrs: ul4.AST._ul4onattrs.concat(["key", "value", "varname", "container", "condition"]),
		formatjs: function(indent)
		{
			var result = "(function(){var result={};for(var iter=ul4._iter(" + this.container.formatjs(indent) + ");;){var item=iter();if(item===null)break;";
			result += "ul4._unpackvariable(vars, " + ul4._fu_asjson(this.varname) + ", item[0]);";
			if (this.condition !== null)
				result += "if(ul4._fu_bool(" + this.condition.formatjs(indent) + "))";
			result += "result[" + this.key.formatjs(indent) + "]=" + this.value.formatjs(indent) + ";}return result;})()";
			return result;
		},
		format: function(indent)
		{
			return "{ " + this.key.format(indent) + " : " + this.value.format(indent) + " for " + ul4.formatnestedname(this.varname) + " in " + this.container.format(indent) + (this.condition !== null ? " if " + this.condition.format(indent) : "") + " }";
		},
		precedence: 11
	}
);

ul4.GenExpr = ul4._inherit(
	ul4.AST,
	{
		create: function(location, item, varname, container, condition)
		{
			var genexp = ul4.AST.create.call(this, location);
			genexp.item = item;
			genexp.varname = varname;
			genexp.container = container;
			genexp.condition = condition;
			return genexp;
		},
		_ul4onattrs: ul4.AST._ul4onattrs.concat(["item", "varname", "container", "condition"]),
		formatjs: function(indent)
		{
			var v = [];
			v.push("ul4._markiter(");
				v.push("(function(container){");
					v.push("var iter=ul4._iter(container);");
					v.push("return(function(){");
						v.push("var item;");
						v.push("for (;;)");
						v.push("{");
							v.push("item = iter();");
							v.push("if(item===null)");
								v.push("return null;");
							v.push("ul4._unpackvariable(vars, " + ul4._fu_asjson(this.varname) + ", item[0]);");
							if (this.condition !== null)
								v.push("if(ul4._fu_bool(" + this.condition.formatjs(indent) + "))");
							v.push("break;");
						v.push("}");
						v.push("return[" + this.item.formatjs(indent) + "];");
					v.push("})");
				v.push("})(" + this.container.formatjs(indent) + ")");
			v.push(")");
			return v.join("");
		},
		format: function(indent)
		{
			return "( " + this.item.format(indent) + " for " + ul4.formatnestedname(this.varname) + " in " + this.container.format(indent) + (this.condition !== null ? " if " + this.condition.format(indent) : "") + " )";
		},
		precedence: 11
	}
);

ul4.Var = ul4._inherit(
	ul4.AST,
	{
		create: function(location, name)
		{
			var variable = ul4.AST.create.call(this, location);
			variable.name = name;
			return variable;
		},
		_ul4onattrs: ul4.AST._ul4onattrs.concat(["name"]),
		formatjs: function(indent)
		{
			return "vars[" + ul4._fu_asjson(this.name) + "]";
		},
		format: function(indent)
		{
			return this.name;
		},
		precedence: 11
	}
);

ul4.Unary = ul4._inherit(
	ul4.AST,
	{
		create: function(location, obj)
		{
			var unary = ul4.AST.create.call(this, location);
			unary.obj = obj;
			return unary;
		},
		_ul4onattrs: ul4.AST._ul4onattrs.concat(["obj"]),
		formatjs: function(indent)
		{
			return "ul4._op_" + this._name() + "(" + this.obj.formatjs(indent) + ")";
		}
	}
);

ul4.Neg = ul4._inherit(
	ul4.Unary,
	{
		format: function(indent)
		{
			return "-" + this._formatop(this.obj);
		},
		precedence: 7
	}
);

ul4.Not = ul4._inherit(
	ul4.Unary,
	{
		format: function(indent)
		{
			return "not " + this._formatop(this.obj);
		},
		precedence: 2
	}
);

ul4.Print = ul4._inherit(
	ul4.Unary,
	{
		formatjs: function(indent)
		{
			return this._line(indent, "out.push(ul4._fu_str(" + this.obj.formatjs(indent) + "));");
		},
		format: function(indent)
		{
			return this._line(indent, "print " + this.obj.format(indent));
		}
	}
);

ul4.PrintX = ul4._inherit(
	ul4.Unary,
	{
		formatjs: function(indent)
		{
			return this._line(indent, "out.push(ul4._fu_xmlescape(" + this.obj.formatjs(indent) + "));");
		},
		format: function(indent)
		{
			return this._line(indent, "printx " + this.obj.format(indent));
		}
	}
);

ul4.Binary = ul4._inherit(
	ul4.AST,
	{
		create: function(location, obj1, obj2)
		{
			var binary = ul4.AST.create.call(this, location);
			binary.obj1 = obj1;
			binary.obj2 = obj2;
			return binary;
		},
		_ul4onattrs: ul4.AST._ul4onattrs.concat(["obj1", "obj2"]),
		formatjs: function(indent)
		{
			return "ul4._op_" + this._name() + "(" + this.obj1.formatjs(indent) + ", " + this.obj2.formatjs(indent) + ")";
		}
	}
);

ul4.GetItem = ul4._inherit(
	ul4.Binary,
	{
		format: function(indent)
		{
			return this._formatop(this.obj1) + "[" + this.obj2.format(0) + "]";
		},
		precedence: 9,
		associative: false
	}
);

ul4.EQ = ul4._inherit(
	ul4.Binary,
	{
		format: function(indent)
		{
			return this._formatop(this.obj1) + " == " + this._formatop(this.obj2);
		},
		precedence: 4,
		associative: false
	}
);

ul4.NE = ul4._inherit(
	ul4.Binary,
	{
		format: function(indent)
		{
			return this._formatop(this.obj1) + " != " + this._formatop(this.obj2);
		},
		precedence: 4,
		associative: false
	}
);

ul4.LT = ul4._inherit(
	ul4.Binary,
	{
		format: function(indent)
		{
			return this._formatop(this.obj1) + " < " + this._formatop(this.obj2);
		},
		precedence: 4,
		associative: false
	}
);

ul4.LE = ul4._inherit(
	ul4.Binary,
	{
		format: function(indent)
		{
			return this._formatop(this.obj1) + " <= " + this._formatop(this.obj2);
		},
		precedence: 4,
		associative: false
	}
);

ul4.GT = ul4._inherit(
	ul4.Binary,
	{
		format: function(indent)
		{
			return this._formatop(this.obj1) + " > " + this._formatop(this.obj2);
		},
		precedence: 4,
		associative: false
	}
);

ul4.GE = ul4._inherit(
	ul4.Binary,
	{
		format: function(indent)
		{
			return this._formatop(this.obj1) + " >= " + this._formatop(this.obj2);
		},
		precedence: 4,
		associative: false
	}
);

ul4.Contains = ul4._inherit(
	ul4.Binary,
	{
		format: function(indent)
		{
			return this._formatop(this.obj1) + " in " + this._formatop(this.obj2);
		},
		precedence: 3,
		associative: false
	}
);

ul4.NotContains = ul4._inherit(
	ul4.Binary,
	{
		format: function(indent)
		{
			return this._formatop(this.obj1) + " not in " + this._formatop(this.obj2);
		},
		precedence: 3,
		associative: false
	}
);

ul4.Add = ul4._inherit(
	ul4.Binary,
	{
		format: function(indent)
		{
			return this._formatop(this.obj1) + " + " + this._formatop(this.obj2);
		},
		precedence: 5
	}
);

ul4.Sub = ul4._inherit(
	ul4.Binary,
	{
		format: function(indent)
		{
			return this._formatop(this.obj1) + " - " + this._formatop(this.obj2);
		},
		precedence: 5,
		associative: false
	}
);

ul4.Mul = ul4._inherit(
	ul4.Binary,
	{
		format: function(indent)
		{
			return this._formatop(this.obj1) + " * " + this._formatop(this.obj2);
		},
		precedence: 6
	}
);

ul4.FloorDiv = ul4._inherit(
	ul4.Binary,
	{
		format: function(indent)
		{
			return this._formatop(this.obj1) + " // " + this._formatop(this.obj2);
		},
		precedence: 6,
		associative: false
	}
);

ul4.TrueDiv = ul4._inherit(
	ul4.Binary,
	{
		format: function(indent)
		{
			return this._formatop(this.obj1) + " / " + this._formatop(this.obj2);
		},
		precedence: 6,
		associative: false
	}
);

ul4.Mod = ul4._inherit(
	ul4.Binary,
	{
		format: function(indent)
		{
			return this._formatop(this.obj1) + " % " + this._formatop(this.obj2);
		},
		precedence: 6,
		associative: false
	}
);

ul4.And = ul4._inherit(
	ul4.Binary,
	{
		formatjs: function(indent)
		{
			return "(function(){var obj1=" + this.obj1.formatjs(indent) + "; return (!ul4._fu_bool(obj1)) ? obj1 : " + this.obj2.formatjs(indent) + ";})()";
		},
		format: function(indent)
		{
			return this._formatop(this.obj1) + " and " + this._formatop(this.obj2);
		},
		precedence: 1
	}
);

ul4.Or = ul4._inherit(
	ul4.Binary,
	{
		formatjs: function(indent)
		{
			return "(function(){var obj1=" + this.obj1.formatjs(indent) + "; return ul4._fu_bool(obj1) ? obj1 : " + this.obj2.formatjs(indent) + ";})()";
		},
		format: function(indent)
		{
			return this._formatop(this.obj1) + " or " + this._formatop(this.obj2);
		},
		precedence: 0
	}
);

ul4.GetAttr = ul4._inherit(
	ul4.AST,
	{
		create: function(location, obj, attrname)
		{
			var getattr = ul4.AST.create.call(this, location);
			getattr.obj = obj;
			getattr.attrname = attrname;
			return getattr;
		},
		_ul4onattrs: ul4.AST._ul4onattrs.concat(["obj", "attrname"]),
		formatjs: function(indent)
		{
			return "ul4._op_getitem(" + this.obj.formatjs(indent) + ", " + ul4._fu_repr(this.attrname) + ")";
		},
		format: function(indent)
		{
			return this._formatop(this.obj) + "." + this.attrname;
		},
		precedence: 9,
		associative: false
	}
);

ul4.CallFunc = ul4._inherit(
	ul4.AST,
	{
		create: function(location, funcname, args)
		{
			var callfunc = ul4.AST.create.call(this, location);
			callfunc.funcname = funcname;
			callfunc.args = args;
			return callfunc;
		},
		_ul4onattrs: ul4.AST._ul4onattrs.concat(["funcname", "args"]),
		formatjs: function(indent)
		{
			if (this.funcname === "vars" || this.funcname === "get")
			{
				var v = [];
				for (var i in this.args)
					v.push(", " + this.args[i].formatjs(indent));
				return "ul4._fu_" + this.funcname + "(vars" + v.join("") + ")";
			}
			else
			{
				var v = [];
				for (var i in this.args)
					v.push(this.args[i].formatjs(indent));
				return "ul4._fu_" + this.funcname + "(" + v.join(", ") + ")";
			}
		},
		format: function(indent)
		{
			var v = [];
			for (var i in this.args)
				v.push(this.args[i].format(indent));
			return this.funcname + "(" + v.join(", ") + ")";
		},
		precedence: 10,
		associative: false
	}
);

ul4.GetSlice = ul4._inherit(
	ul4.AST,
	{
		create: function(location, obj, index1, index2)
		{
			var getslice = ul4.AST.create.call(this, location);
			getslice.obj = obj;
			getslice.index1 = index1;
			getslice.index2 = index2;
			return getslice;
		},
		_ul4onattrs: ul4.AST._ul4onattrs.concat(["obj", "index1", "index2"]),
		format: function(indent)
		{
			return this._formatop(this.obj) + "[" + (this.index1 !== null ? this.index1.format(indent) : "") + ":" + (this.index2 !== null ? this.index2.format(indent) : "") + "]";
		},
		formatjs: function(indent)
		{
			return "ul4._op_getslice(" + this.obj.formatjs(indent) + ", " + (this.index1 !== null ? this.index1.formatjs(indent) : "null") + ", " + (this.index2 !== null ? this.index2.formatjs(indent) : "null") + ")";
		},
		precedence: 8,
		associative: false
	}
);

ul4.CallMeth = ul4._inherit(
	ul4.AST,
	{
		create: function(location, methname, obj, args)
		{
			var callfunc = ul4.AST.create.call(this, location);
			callfunc.methname = methname;
			callfunc.obj = obj;
			callfunc.args = args;
			return callfunc;
		},
		_ul4onattrs: ul4.AST._ul4onattrs.concat(["methname", "obj", "args"]),
		formatjs: function(indent)
		{
			var v = [this.obj.formatjs(indent)];
			for (var i in this.args)
				v.push(this.args[i].formatjs(indent));
			return "ul4._me_" + this.methname + "(" + v.join(", ") + ")";
		},
		format: function(indent)
		{
			var v = [];
			for (var i in this.args)
				v.push(this.args[i].format(indent));
			return this._formatop(this.obj) + "." + this.methname + "(" + v.join(", ") + ")";
		},
		precedence: 10,
		associative: false
	}
);

ul4.CallMethKeywords = ul4._inherit(
	ul4.AST,
	{
		create: function(location, methname, obj, args)
		{
			var callfunc = ul4.AST.create.call(this, location);
			callfunc.methname = methname;
			callfunc.obj = obj;
			callfunc.args = args;
			return callfunc;
		},
		_ul4onattrs: ul4.AST._ul4onattrs.concat(["methname", "obj", "args"]),
		format: function(indent)
		{
			var v = [];
			for (var i in this.args)
			{
				var arg = this.args[i];
				if (arg.length == 2)
					v.push(arg[0] + "=" + arg[1].format(indent));
				else
					v.push("**" + arg[0].format(indent));
			}
			return this._formatop(this.obj) + "." + this.methname + "(" + v.join(", ") + ")";
		},
		formatjs: function(indent)
		{
			var v = [];
			for (var i in this.args)
			{
				var arg = this.args[i];
				if (arg.length == 2)
					v.push("[" + ul4._fu_asjson(arg[0]) + ", " + arg[1].formatjs(indent) + "]");
				else
					v.push("[" + arg[0].formatjs(indent) + "]");
			}
			if (this.methname === "renders")
				return this.obj.formatjs(indent) + ".renders(ul4._makedict(" + v.join(", ") + "))";
			else if (this.methname === "render")
				return "out.push.apply(out, " + this.obj.formatjs(indent) + ".render(ul4._makedict(" + v.join(", ") + ")))";
			else
				return "";
		},
		precedence: 9,
		associative: false
	}
);

ul4.Render = ul4._inherit(
	ul4.Unary,
	{
		format: function(indent)
		{
			return this._line(indent, "render " + this.obj.format(indent));
		},
		formatjs: function(indent)
		{
			if (this.obj.isa(ul4.CallMeth) || this.obj.isa(ul4.CallMethKeywords) && this.obj.methname === "render")
				return this._line(indent, this.obj.formatjs(indent));
			else
				return this._line(indent, "out.push(ul4._fu_str(" + this.obj.formatjs(indent) + "))");
		}
	}
);

ul4.ChangeVar = ul4._inherit(
	ul4.AST,
	{
		create: function(location, varname, value)
		{
			var changevar = ul4.AST.create.call(this, location);
			changevar.varname = varname;
			changevar.value = value;
			return changevar;
		},
		_ul4onattrs: ul4.AST._ul4onattrs.concat(["varname", "value"])
	}
);

ul4.StoreVar = ul4._inherit(
	ul4.ChangeVar,
	{
		format: function(indent)
		{
			return this._line(indent, ul4.formatnestedname(this.varname) + " = " + this.value.format(indent));
		},
		formatjs: function(indent)
		{
			return this._line(indent, "ul4._unpackvariable(vars, " + ul4._fu_asjson(this.varname) + ", " + this.value.formatjs(indent) + ");");
		}
	}
);

ul4.AddVar = ul4._inherit(
	ul4.ChangeVar,
	{
		format: function(indent)
		{
			return this._line(indent, this.varname + " += " + this.value.format(indent));
		},
		formatjs: function(indent)
		{
			var varname = ul4._fu_asjson(this.varname);
			return this._line(indent, "vars[" + varname + "] = ul4._op_add(vars[" + varname + "], " + this.value.formatjs(indent) + ");");
		}
	}
);

ul4.SubVar = ul4._inherit(
	ul4.ChangeVar,
	{
		format: function(indent)
		{
			return this._line(indent, this.varname + " -= " + this.value.format(indent));
		},
		formatjs: function(indent)
		{
			var varname = ul4._fu_asjson(this.varname);
			return this._line(indent, "vars[" + varname + "] = ul4._op_sub(vars[" + varname + "], " + this.value.formatjs(indent) + ");");
		}
	}
);

ul4.MulVar = ul4._inherit(
	ul4.ChangeVar,
	{
		format: function(indent)
		{
			return this._line(indent, this.varname + " *= " + this.value.format(indent));
		},
		formatjs: function(indent)
		{
			var varname = ul4._fu_asjson(this.varname);
			return this._line(indent, "vars[" + varname + "] = ul4._op_mul(vars[" + varname + "], " + this.value.formatjs(indent) + ");");
		}
	}
);

ul4.TrueDivVar = ul4._inherit(
	ul4.ChangeVar,
	{
		format: function(indent)
		{
			return this._line(indent, this.varname + " /= " + this.value.format(indent));
		},
		formatjs: function(indent)
		{
			var varname = ul4._fu_asjson(this.varname);
			return this._line(indent, "vars[" + varname + "] = ul4._op_truediv(vars[" + varname + "], " + this.value.formatjs(indent) + ");");
		}
	}
);

ul4.FloorDivVar = ul4._inherit(
	ul4.ChangeVar,
	{
		format: function(indent)
		{
			return this._line(indent, this.varname + " //= " + this.value.format(indent));
		},
		formatjs: function(indent)
		{
			var varname = ul4._fu_asjson(this.varname);
			return this._line(indent, "vars[" + varname + "] = ul4._op_floordiv(vars[" + varname + "], " + this.value.formatjs(indent) + ");");
		}
	}
);

ul4.ModVar = ul4._inherit(
	ul4.ChangeVar,
	{
		format: function(indent)
		{
			return this._line(indent, this.varname + " %= " + this.value.format(indent));
		},
		formatjs: function(indent)
		{
			var varname = ul4._fu_asjson(this.varname);
			return this._line(indent, "vars[" + varname + "] = ul4._op_mod(vars[" + varname + "], " + this.value.formatjs(indent) + ");");
		}
	}
);

ul4.DelVar = ul4._inherit(
	ul4.AST,
	{
		create: function(location, varname)
		{
			var delvar = ul4.AST.create.call(this, location);
			delvar.varname = varname;
			return delvar;
		},
		_ul4onattrs: ul4.AST._ul4onattrs.concat(["varname"]),
		format: function(indent)
		{
			return this._line(indent, "del " + this.varname);
		},
		formatjs: function(indent)
		{
			return this._line(indent, "vars[" + ul4._fu_asjson(this.varname) + "] = null;");
		}
	}
);

ul4.Block = ul4._inherit(
	ul4.AST,
	{
		create: function(location)
		{
			var block = ul4.AST.create.call(this, location);
			block.endlocation = null;
			block.content = [];
			return block;
		},
		_ul4onattrs: ul4.AST._ul4onattrs.concat(["endlocation", "content"]),
		_add2template: function(template)
		{
			ul4.AST._add2template.call(this, template);
			for (var i in this.content)
				this.content[i]._add2template(template);
		},
		_formatjs_content: function(indent)
		{
			var v = [];
			for (var i in this.content)
				v.push(this.content[i].formatjs(indent));
			return v.join("");
		},
		format: function(indent)
		{
			var v = [];
			v.push(this._line(indent, "{"));
			++indent;
			for (var i in this.content)
				v.push(this.content[i].format(indent));
			--indent;
			v.push(this._line(indent, "}"));
			return v.join("");
		}
	}
);

ul4.For = ul4._inherit(
	ul4.Block,
	{
		create: function(location, varname, container)
		{
			var for_ = ul4.Block.create.call(this, location);
			for_.varname = varname;
			for_.container = container;
			return for_;
		},
		_ul4onattrs: ul4.Block._ul4onattrs.concat(["varname", "container"]),
		formatjs: function(indent)
		{
			var v = [];
			v.push(this._line(indent, "for (var iter" + this.__id__ + " = ul4._iter(" + this.container.formatjs(indent) + ");;)"));
			v.push(this._line(indent, "{"));
			++indent;
			v.push(this._line(indent, "var item" + this.__id__ + " = iter" + this.__id__ + "();"));
			v.push(this._line(indent, "if (item" + this.__id__ + " === null)"));
			v.push(this._line(indent+1, "break;"));
			v.push(this._line(indent, "ul4._unpackvariable(vars, " + ul4._fu_asjson(this.varname) + ", item" + this.__id__ + "[0]);"));
			v.push(this._formatjs_content(indent));
			--indent;
			v.push(this._line(indent, "}"));
			return v.join("");
		},
		format: function(indent)
		{
			return this._line(indent, "for " + ul4.formatnestedname(this.varname) + " in " + this.container.format(indent)) + ul4.Block.format.call(this, indent);
		}
	}
);

ul4.Break = ul4._inherit(
	ul4.AST,
	{
		formatjs: function(indent)
		{
			return this._line(indent, "break;");
		},
		format: function(indent)
		{
			return this._line(indent, "break");
		}
	}
);

ul4.Continue = ul4._inherit(
	ul4.AST,
	{
		formatjs: function(indent)
		{
			return this._line(indent, "continue;");
		},
		format: function(indent)
		{
			return this._line(indent, "continue");
		}
	}
);

ul4.IfElIfElse = ul4._inherit(
	ul4.Block,
	{
		formatjs: function(indent)
		{
			return this._formatjs_content(indent);
		},
		format: function(indent)
		{
			var v = [];
			for (var i in this.content)
				v.push(this.content[i].format(indent));
			return v.join("");
		}
	}
);

ul4.ConditionalBlock = ul4._inherit(
	ul4.Block,
	{
		create: function(location, condition)
		{
			var block = ul4.Block.create.call(this, location);
			block.condition = condition;
			return block;
		},
		_ul4onattrs: ul4.Block._ul4onattrs.concat(["condition"]),
		formatjs: function(indent)
		{
			var v = [];
			v.push(this._line(indent, this._sourcejs + " (ul4._fu_bool(" + this.condition.formatjs(indent) + "))"));
			v.push(this._line(indent, "{"));
			v.push(this._formatjs_content(indent+1));
			v.push(this._line(indent, "}"));
			return v.join("");
		},
		format: function(indent)
		{
			return this._line(indent, this._name() + " " + this.condition.format(indent)) + ul4.Block.format.call(this, indent);
		}
	}
);

ul4.If = ul4._inherit(
	ul4.ConditionalBlock,
	{
		_sourcejs: "if"
	}
);

ul4.ElIf = ul4._inherit(
	ul4.ConditionalBlock,
	{
		_sourcejs: "else if"
	}
);

ul4.Else = ul4._inherit(
	ul4.Block,
	{
		formatjs: function(indent)
		{
			var v = [];
			v.push(this._line(indent, "else"));
			v.push(this._line(indent, "{"));
			v.push(this._formatjs_content(indent+1));
			v.push(this._line(indent, "}"));
			return v.join("");
		},
		format: function(indent)
		{
			return this._line(indent, "else") + ul4.Block.format.call(this, indent);
		}
	}
);

ul4.Template = ul4._inherit(
	ul4.Block,
	{
		create: function(location, source, name, startdelim, enddelim)
		{
			var template = ul4.Block.create.call(this, location);
			template.endlocation = null;
			template.source = source;
			template.name = name;
			template.startdelim = startdelim;
			template.enddelim = enddelim;
			template._jssource = null;
			template._jsfunction = null;
			template._asts = null;
			return template;
		},
		ul4ondump: function(encoder)
		{
			encoder.dump(ul4.version);
			encoder.dump(this.source);
			encoder.dump(this.name);
			encoder.dump(this.startdelim);
			encoder.dump(this.enddelim);
			ul4.Block.ul4ondump.call(this, encoder);
		},
		ul4onload: function(decoder)
		{
			var version = decoder.load();
			if (version !== ul4.version)
				throw "invalid version, expected " + ul4.version + ", got " + version;
			this.source = decoder.load();
			this.name = decoder.load();
			this.startdelim = decoder.load();
			this.enddelim = decoder.load();
			ul4.Block.ul4onload.call(this, decoder);
		},
		formatjs: function(indent)
		{
			return this._line(indent, "vars[" + ul4._fu_asjson(this.name) + "] = self._getast(" + this.__id__ + ");");
		},
		format: function(indent)
		{
			return this._line(indent, "def " + (this.name !== null ? this.name : "unnamed")) + ul4.Block.format.call(this, indent);
		},
		_getast: function(id)
		{
			if (this._asts === null)
			{
				this._asts = {};
				this._add2template(this);
			}
			return this._asts[id];
		},
		jssource: function()
		{
			if (this._jssource === null)
			{
				var v = [];
				v.push(this._line(0, "(function(self, vars)"));
				v.push(this._line(0, "{"));
				v.push(this._line(1, "var out = [];"));
				v.push(this._formatjs_content(1));
				v.push(this._line(1, "return out;"));
				v.push(this._line(0, "})"));
				this._jssource = v.join("");
			}
			return this._jssource;
		},
		render: function(vars)
		{
			vars = vars || {};
			if (this._jsfunction === null)
				this._jsfunction = eval(this.jssource());
			return this._jsfunction(this, vars);
		},
		renders: function(vars)
		{
			return this.render(vars).join("");
		},
		loads: function(string)
		{
			return ul4on.loads(string);
		},
		__type__: "template" // used by ``istemplate()``
	}
);

(function(){
	var register = function(name, object)
	{
		object.type = name;
		ul4on.register("de.livinglogic.ul4." + name, object);
	};
	register("location", ul4.Location);
	register("text", ul4.Text);
	register("const", ul4.Const);
	register("list", ul4.List);
	register("listcomp", ul4.ListComp);
	register("dict", ul4.Dict);
	register("dictcomp", ul4.DictComp);
	register("genexpr", ul4.GenExpr);
	register("var", ul4.Var);
	register("not", ul4.Not);
	register("neg", ul4.Neg);
	register("print", ul4.Print);
	register("printx", ul4.PrintX);
	register("getitem", ul4.GetItem);
	register("eq", ul4.EQ);
	register("ne", ul4.NE);
	register("lt", ul4.LT);
	register("le", ul4.LE);
	register("gt", ul4.GT);
	register("ge", ul4.GE);
	register("notcontains", ul4.NotContains);
	register("contains", ul4.Contains);
	register("add", ul4.Add);
	register("sub", ul4.Sub);
	register("mul", ul4.Mul);
	register("floordiv", ul4.FloorDiv);
	register("truediv", ul4.TrueDiv);
	register("mod", ul4.Mod);
	register("and", ul4.And);
	register("or", ul4.Or);
	register("getslice", ul4.GetSlice);
	register("getattr", ul4.GetAttr);
	register("callfunc", ul4.CallFunc);
	register("callmeth", ul4.CallMeth);
	register("callmethkw", ul4.CallMethKeywords);
	register("render", ul4.Render);
	register("storevar", ul4.StoreVar);
	register("addvar", ul4.AddVar);
	register("subvar", ul4.SubVar);
	register("mulvar", ul4.MulVar);
	register("truedivvar", ul4.TrueDivVar);
	register("floordivvar", ul4.FloorDivVar);
	register("modvar", ul4.ModVar);
	register("delvar", ul4.DelVar);
	register("for", ul4.For);
	register("break", ul4.Break);
	register("continue", ul4.Continue);
	register("ieie", ul4.IfElIfElse);
	register("if", ul4.If);
	register("elif", ul4.ElIf);
	register("else", ul4.Else);
	register("template", ul4.Template);
})();
