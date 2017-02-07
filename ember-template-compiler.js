;(function() {
/*!
 * @overview  Ember - JavaScript Application Framework
 * @copyright Copyright 2011-2017 Tilde Inc. and contributors
 *            Portions Copyright 2006-2011 Strobe Inc.
 *            Portions Copyright 2008-2011 Apple Inc. All rights reserved.
 * @license   Licensed under MIT license
 *            See https://raw.github.com/emberjs/ember.js/master/LICENSE
 * @version   2.13.0-alpha.1-canary+76698a45
 */

var enifed, requireModule, Ember;
var mainContext = this; // Used in ember-environment/lib/global.js

(function() {
  var isNode = typeof window === 'undefined' &&
    typeof process !== 'undefined' && {}.toString.call(process) === '[object process]';

  if (!isNode) {
    Ember = this.Ember = this.Ember || {};
  }

  if (typeof Ember === 'undefined') { Ember = {}; }

  if (typeof Ember.__loader === 'undefined') {
    var registry = {};
    var seen = {};

    enifed = function(name, deps, callback) {
      var value = { };

      if (!callback) {
        value.deps = [];
        value.callback = deps;
      } else {
        value.deps = deps;
        value.callback = callback;
      }

      registry[name] = value;
    };

    requireModule = function(name) {
      return internalRequire(name, null);
    };

    // setup `require` module
    requireModule['default'] = requireModule;

    requireModule.has = function registryHas(moduleName) {
      return !!registry[moduleName] || !!registry[moduleName + '/index'];
    };

    function missingModule(name, referrerName) {
      if (referrerName) {
        throw new Error('Could not find module ' + name + ' required by: ' + referrerName);
      } else {
        throw new Error('Could not find module ' + name);
      }
    }

    function internalRequire(_name, referrerName) {
      var name = _name;
      var mod = registry[name];

      if (!mod) {
        name = name + '/index';
        mod = registry[name];
      }

      var exports = seen[name];

      if (exports !== undefined) {
        return exports;
      }

      exports = seen[name] = {};

      if (!mod) {
        missingModule(_name, referrerName);
      }

      var deps = mod.deps;
      var callback = mod.callback;
      var reified = new Array(deps.length);

      for (var i = 0; i < deps.length; i++) {
        if (deps[i] === 'exports') {
          reified[i] = exports;
        } else if (deps[i] === 'require') {
          reified[i] = requireModule;
        } else {
          reified[i] = internalRequire(deps[i], name);
        }
      }

      callback.apply(this, reified);

      return exports;
    }

    requireModule._eak_seen = registry;

    Ember.__loader = {
      define: enifed,
      require: requireModule,
      registry: registry
    };
  } else {
    enifed = Ember.__loader.define;
    requireModule = Ember.__loader.require;
  }
})();

function classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError('Cannot call a class as a function');
  }
}

function inherits(subClass, superClass) {
  if (typeof superClass !== 'function' && superClass !== null) {
    throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });

  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : defaults(subClass, superClass);
}

function taggedTemplateLiteralLoose(strings, raw) {
  strings.raw = raw;
  return strings;
}

function defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ('value' in descriptor) descriptor.writable = true;
    Object.defineProperty(target, descriptor.key, descriptor);
  }
}

function createClass(Constructor, protoProps, staticProps) {
  if (protoProps) defineProperties(Constructor.prototype, protoProps);
  if (staticProps) defineProperties(Constructor, staticProps);
  return Constructor;
}

function interopExportWildcard(obj, defaults) {
  var newObj = defaults({}, obj);
  delete newObj['default'];
  return newObj;
}

function defaults(obj, defaults) {
  var keys = Object.getOwnPropertyNames(defaults);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var value = Object.getOwnPropertyDescriptor(defaults, key);
    if (value && value.configurable && obj[key] === undefined) {
      Object.defineProperty(obj, key, value);
    }
  }
  return obj;
}

babelHelpers = {
  classCallCheck: classCallCheck,
  inherits: inherits,
  taggedTemplateLiteralLoose: taggedTemplateLiteralLoose,
  slice: Array.prototype.slice,
  createClass: createClass,
  interopExportWildcard: interopExportWildcard,
  defaults: defaults
};

enifed('@glimmer/compiler', ['exports', '@glimmer/syntax', '@glimmer/util', '@glimmer/wire-format'], function (exports, _glimmerSyntax, _glimmerUtil, _glimmerWireFormat) {
    'use strict';

    var push = Array.prototype.push;

    var Frame = function Frame() {
        this.parentNode = null;
        this.children = null;
        this.childIndex = null;
        this.childCount = null;
        this.childTemplateCount = 0;
        this.mustacheCount = 0;
        this.actions = [];
        this.blankChildTextNodes = null;
        this.symbols = null;
    };

    var SymbolTable = (function () {
        function SymbolTable(symbols) {
            var parent = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

            this.symbols = symbols;
            this.parent = parent;
        }

        /**
         * Takes in an AST and outputs a list of actions to be consumed
         * by a compiler. For example, the template
         *
         *     foo{{bar}}<div>baz</div>
         *
         * produces the actions
         *
         *     [['startProgram', [programNode, 0]],
         *      ['text', [textNode, 0, 3]],
         *      ['mustache', [mustacheNode, 1, 3]],
         *      ['openElement', [elementNode, 2, 3, 0]],
         *      ['text', [textNode, 0, 1]],
         *      ['closeElement', [elementNode, 2, 3],
         *      ['endProgram', [programNode]]]
         *
         * This visitor walks the AST depth first and backwards. As
         * a result the bottom-most child template will appear at the
         * top of the actions list whereas the root template will appear
         * at the bottom of the list. For example,
         *
         *     <div>{{#if}}foo{{else}}bar<b></b>{{/if}}</div>
         *
         * produces the actions
         *
         *     [['startProgram', [programNode, 0]],
         *      ['text', [textNode, 0, 2, 0]],
         *      ['openElement', [elementNode, 1, 2, 0]],
         *      ['closeElement', [elementNode, 1, 2]],
         *      ['endProgram', [programNode]],
         *      ['startProgram', [programNode, 0]],
         *      ['text', [textNode, 0, 1]],
         *      ['endProgram', [programNode]],
         *      ['startProgram', [programNode, 2]],
         *      ['openElement', [elementNode, 0, 1, 1]],
         *      ['block', [blockNode, 0, 1]],
         *      ['closeElement', [elementNode, 0, 1]],
         *      ['endProgram', [programNode]]]
         *
         * The state of the traversal is maintained by a stack of frames.
         * Whenever a node with children is entered (either a ProgramNode
         * or an ElementNode) a frame is pushed onto the stack. The frame
         * contains information about the state of the traversal of that
         * node. For example,
         *
         *   - index of the current child node being visited
         *   - the number of mustaches contained within its child nodes
         *   - the list of actions generated by its child nodes
         */

        SymbolTable.prototype.hasLocalVariable = function hasLocalVariable(name) {
            var symbols = this.symbols;
            var parent = this.parent;

            return symbols.indexOf(name) >= 0 || parent && parent.hasLocalVariable(name);
        };

        return SymbolTable;
    })();

    function TemplateVisitor() {
        this.frameStack = [];
        this.actions = [];
        this.programDepth = -1;
    }
    // Traversal methods
    TemplateVisitor.prototype.visit = function (node) {
        this[node.type](node);
    };
    TemplateVisitor.prototype.Program = function (program) {
        this.programDepth++;
        var parentFrame = this.getCurrentFrame();
        var programFrame = this.pushFrame();
        if (parentFrame) {
            program.symbols = new SymbolTable(program.blockParams, parentFrame.symbols);
        } else {
            program.symbols = new SymbolTable(program.blockParams);
        }
        var startType = undefined,
            endType = undefined;
        if (this.programDepth === 0) {
            startType = 'startProgram';
            endType = 'endProgram';
        } else {
            startType = 'startBlock';
            endType = 'endBlock';
        }
        programFrame.parentNode = program;
        programFrame.children = program.body;
        programFrame.childCount = program.body.length;
        programFrame.blankChildTextNodes = [];
        programFrame.actions.push([endType, [program, this.programDepth]]);
        programFrame.symbols = program.symbols;
        for (var i = program.body.length - 1; i >= 0; i--) {
            programFrame.childIndex = i;
            this.visit(program.body[i]);
        }
        programFrame.actions.push([startType, [program, programFrame.childTemplateCount, programFrame.blankChildTextNodes.reverse()]]);
        this.popFrame();
        this.programDepth--;
        // Push the completed template into the global actions list
        if (parentFrame) {
            parentFrame.childTemplateCount++;
        }
        push.apply(this.actions, programFrame.actions.reverse());
    };
    TemplateVisitor.prototype.ElementNode = function (element) {
        var parentFrame = this.getCurrentFrame();
        var elementFrame = this.pushFrame();
        elementFrame.parentNode = element;
        elementFrame.children = element.children;
        elementFrame.childCount = element.children.length;
        elementFrame.mustacheCount += element.modifiers.length;
        elementFrame.blankChildTextNodes = [];
        elementFrame.symbols = parentFrame.symbols;
        var actionArgs = [element, parentFrame.childIndex, parentFrame.childCount];
        elementFrame.actions.push(['closeElement', actionArgs]);
        for (var i = element.attributes.length - 1; i >= 0; i--) {
            this.visit(element.attributes[i]);
        }
        for (var i = element.children.length - 1; i >= 0; i--) {
            elementFrame.childIndex = i;
            this.visit(element.children[i]);
        }
        elementFrame.actions.push(['openElement', actionArgs.concat([elementFrame.mustacheCount, elementFrame.blankChildTextNodes.reverse()])]);
        this.popFrame();
        // Propagate the element's frame state to the parent frame
        if (elementFrame.mustacheCount > 0) {
            parentFrame.mustacheCount++;
        }
        parentFrame.childTemplateCount += elementFrame.childTemplateCount;
        push.apply(parentFrame.actions, elementFrame.actions);
    };
    TemplateVisitor.prototype.AttrNode = function (attr) {
        if (attr.value.type !== 'TextNode') {
            this.getCurrentFrame().mustacheCount++;
        }
    };
    TemplateVisitor.prototype.TextNode = function (text) {
        var frame = this.getCurrentFrame();
        if (text.chars === '') {
            frame.blankChildTextNodes.push(domIndexOf(frame.children, text));
        }
        frame.actions.push(['text', [text, frame.childIndex, frame.childCount]]);
    };
    TemplateVisitor.prototype.BlockStatement = function (node) {
        var frame = this.getCurrentFrame();
        frame.mustacheCount++;
        frame.actions.push(['block', [node, frame.childIndex, frame.childCount]]);
        if (node.inverse) {
            this.visit(node.inverse);
        }
        if (node.program) {
            this.visit(node.program);
        }
    };
    TemplateVisitor.prototype.PartialStatement = function (node) {
        var frame = this.getCurrentFrame();
        frame.mustacheCount++;
        frame.actions.push(['mustache', [node, frame.childIndex, frame.childCount]]);
    };
    TemplateVisitor.prototype.CommentStatement = function (text) {
        var frame = this.getCurrentFrame();
        frame.actions.push(['comment', [text, frame.childIndex, frame.childCount]]);
    };
    TemplateVisitor.prototype.MustacheCommentStatement = function () {
        // Intentional empty: Handlebars comments should not affect output.
    };
    TemplateVisitor.prototype.MustacheStatement = function (mustache) {
        var frame = this.getCurrentFrame();
        frame.mustacheCount++;
        frame.actions.push(['mustache', [mustache, frame.childIndex, frame.childCount]]);
    };
    // Frame helpers
    TemplateVisitor.prototype.getCurrentFrame = function () {
        return this.frameStack[this.frameStack.length - 1];
    };
    TemplateVisitor.prototype.pushFrame = function () {
        var frame = new Frame();
        this.frameStack.push(frame);
        return frame;
    };
    TemplateVisitor.prototype.popFrame = function () {
        return this.frameStack.pop();
    };
    // Returns the index of `domNode` in the `nodes` array, skipping
    // over any nodes which do not represent DOM nodes.
    function domIndexOf(nodes, domNode) {
        var index = -1;
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (node.type !== 'TextNode' && node.type !== 'ElementNode') {
                continue;
            } else {
                index++;
            }
            if (node === domNode) {
                return index;
            }
        }
        return -1;
    }

    var Block = (function () {
        function Block() {
            this.type = "block";
            this.statements = [];
            this.positionals = [];
        }

        Block.prototype.toJSON = function toJSON() {
            return {
                statements: this.statements,
                locals: this.positionals
            };
        };

        Block.prototype.push = function push(statement) {
            this.statements.push(statement);
        };

        return Block;
    })();

    var TemplateBlock = (function (_Block) {
        babelHelpers.inherits(TemplateBlock, _Block);

        function TemplateBlock() {
            _Block.apply(this, arguments);
            this.type = "template";
            this.yields = new _glimmerUtil.DictSet();
            this.named = new _glimmerUtil.DictSet();
            this.blocks = [];
            this.hasPartials = false;
        }

        TemplateBlock.prototype.toJSON = function toJSON() {
            return {
                statements: this.statements,
                locals: this.positionals,
                named: this.named.toArray(),
                yields: this.yields.toArray(),
                hasPartials: this.hasPartials
            };
        };

        return TemplateBlock;
    })(Block);

    var ComponentBlock = (function (_Block2) {
        babelHelpers.inherits(ComponentBlock, _Block2);

        function ComponentBlock() {
            _Block2.apply(this, arguments);
            this.type = "component";
            this.attributes = [];
            this.arguments = [];
            this.inParams = true;
        }

        ComponentBlock.prototype.push = function push(statement) {
            if (this.inParams) {
                if (_glimmerWireFormat.Statements.isFlushElement(statement)) {
                    this.inParams = false;
                } else if (_glimmerWireFormat.Statements.isArgument(statement)) {
                    this.arguments.push(statement);
                } else if (_glimmerWireFormat.Statements.isAttribute(statement)) {
                    this.attributes.push(statement);
                } else if (_glimmerWireFormat.Statements.isModifier(statement)) {
                    throw new Error('Compile Error: Element modifiers are not allowed in components');
                } else {
                    throw new Error('Compile Error: only parameters allowed before flush-element');
                }
            } else {
                this.statements.push(statement);
            }
        };

        ComponentBlock.prototype.toJSON = function toJSON() {
            var args = this.arguments;
            var keys = args.map(function (arg) {
                return arg[1];
            });
            var values = args.map(function (arg) {
                return arg[2];
            });
            return {
                attrs: this.attributes,
                args: [keys, values],
                locals: this.positionals,
                statements: this.statements
            };
        };

        return ComponentBlock;
    })(Block);

    var Template = (function () {
        function Template(meta) {
            this.meta = meta;
            this.block = new TemplateBlock();
        }

        Template.prototype.toJSON = function toJSON() {
            return {
                block: this.block.toJSON(),
                meta: this.meta
            };
        };

        return Template;
    })();

    var JavaScriptCompiler = (function () {
        function JavaScriptCompiler(opcodes, meta) {
            this.blocks = new _glimmerUtil.Stack();
            this.values = [];
            this.opcodes = opcodes;
            this.template = new Template(meta);
        }

        JavaScriptCompiler.process = function process(opcodes, meta) {
            var compiler = new JavaScriptCompiler(opcodes, meta);
            return compiler.process();
        };

        JavaScriptCompiler.prototype.process = function process() {
            var _this = this;

            this.opcodes.forEach(function (_ref) {
                var opcode = _ref[0];

                var args = _ref.slice(1);

                if (!_this[opcode]) {
                    throw new Error('unimplemented ' + opcode + ' on JavaScriptCompiler');
                }
                _this[opcode].apply(_this, args);
            });
            return this.template;
        };

        /// Nesting

        JavaScriptCompiler.prototype.startBlock = function startBlock(_ref2) {
            var program = _ref2[0];

            var block = new Block();
            block.positionals = program.blockParams;
            this.blocks.push(block);
        };

        JavaScriptCompiler.prototype.endBlock = function endBlock() {
            var template = this.template;
            var blocks = this.blocks;

            template.block.blocks.push(blocks.pop().toJSON());
        };

        JavaScriptCompiler.prototype.startProgram = function startProgram() {
            this.blocks.push(this.template.block);
        };

        JavaScriptCompiler.prototype.endProgram = function endProgram() {};

        /// Statements

        JavaScriptCompiler.prototype.text = function text(content) {
            this.push(['text', content]);
        };

        JavaScriptCompiler.prototype.append = function append(trusted) {
            this.push(['append', this.popValue(), trusted]);
        };

        JavaScriptCompiler.prototype.comment = function comment(value) {
            this.push(['comment', value]);
        };

        JavaScriptCompiler.prototype.modifier = function modifier(path) {
            var params = this.popValue();
            var hash = this.popValue();
            this.push(['modifier', path, params, hash]);
        };

        JavaScriptCompiler.prototype.block = function block(path, template, inverse) {
            var params = this.popValue();
            var hash = this.popValue();
            var blocks = this.template.block.blocks;
            _glimmerUtil.assert(typeof template !== 'number' || blocks[template] !== null, 'missing block in the compiler');
            _glimmerUtil.assert(typeof inverse !== 'number' || blocks[inverse] !== null, 'missing block in the compiler');
            this.push(['block', path, params, hash, blocks[template], blocks[inverse]]);
        };

        JavaScriptCompiler.prototype.openElement = function openElement(tag, blockParams) {
            if (tag.indexOf('-') !== -1) {
                this.startComponent(blockParams);
            } else {
                this.push(['open-element', tag, blockParams]);
            }
        };

        JavaScriptCompiler.prototype.flushElement = function flushElement() {
            this.push(['flush-element']);
        };

        JavaScriptCompiler.prototype.closeElement = function closeElement(tag) {
            if (tag.indexOf('-') !== -1) {
                var component = this.endComponent();
                this.push(['component', tag, component]);
            } else {
                this.push(['close-element']);
            }
        };

        JavaScriptCompiler.prototype.staticAttr = function staticAttr(name, namespace) {
            var value = this.popValue();
            this.push(['static-attr', name, value, namespace]);
        };

        JavaScriptCompiler.prototype.dynamicAttr = function dynamicAttr(name, namespace) {
            var value = this.popValue();
            this.push(['dynamic-attr', name, value, namespace]);
        };

        JavaScriptCompiler.prototype.trustingAttr = function trustingAttr(name, namespace) {
            var value = this.popValue();
            this.push(['trusting-attr', name, value, namespace]);
        };

        JavaScriptCompiler.prototype.staticArg = function staticArg(name) {
            var value = this.popValue();
            this.push(['static-arg', name.slice(1), value]);
        };

        JavaScriptCompiler.prototype.dynamicArg = function dynamicArg(name) {
            var value = this.popValue();
            this.push(['dynamic-arg', name.slice(1), value]);
        };

        JavaScriptCompiler.prototype.yield = function _yield(to) {
            var params = this.popValue();
            this.push(['yield', to, params]);
            this.template.block.yields.add(to);
        };

        JavaScriptCompiler.prototype.debugger = function _debugger() {
            this.push(['debugger', null, null]);
        };

        JavaScriptCompiler.prototype.hasBlock = function hasBlock(name) {
            this.pushValue(['has-block', name]);
            this.template.block.yields.add(name);
        };

        JavaScriptCompiler.prototype.hasBlockParams = function hasBlockParams(name) {
            this.pushValue(['has-block-params', name]);
            this.template.block.yields.add(name);
        };

        JavaScriptCompiler.prototype.partial = function partial() {
            var params = this.popValue();
            this.push(['partial', params[0]]);
            this.template.block.hasPartials = true;
        };

        /// Expressions

        JavaScriptCompiler.prototype.literal = function literal(value) {
            if (value === undefined) {
                this.pushValue(['undefined']);
            } else {
                this.pushValue(value);
            }
        };

        JavaScriptCompiler.prototype.unknown = function unknown(path) {
            this.pushValue(['unknown', path]);
        };

        JavaScriptCompiler.prototype.arg = function arg(path) {
            this.template.block.named.add(path[0]);
            this.pushValue(['arg', path]);
        };

        JavaScriptCompiler.prototype.get = function get(path) {
            this.pushValue(['get', path]);
        };

        JavaScriptCompiler.prototype.concat = function concat() {
            this.pushValue(['concat', this.popValue()]);
        };

        JavaScriptCompiler.prototype.helper = function helper(path) {
            var params = this.popValue();
            var hash = this.popValue();
            this.pushValue(['helper', path, params, hash]);
        };

        /// Stack Management Opcodes

        JavaScriptCompiler.prototype.startComponent = function startComponent(blockParams) {
            var component = new ComponentBlock();
            component.positionals = blockParams;
            this.blocks.push(component);
        };

        JavaScriptCompiler.prototype.endComponent = function endComponent() {
            var component = this.blocks.pop();
            _glimmerUtil.assert(component.type === 'component', "Compiler bug: endComponent() should end a component");
            return component.toJSON();
        };

        JavaScriptCompiler.prototype.prepareArray = function prepareArray(size) {
            var values = [];
            for (var i = 0; i < size; i++) {
                values.push(this.popValue());
            }
            this.pushValue(values);
        };

        JavaScriptCompiler.prototype.prepareObject = function prepareObject(size) {
            _glimmerUtil.assert(this.values.length >= size, 'Expected ' + size + ' values on the stack, found ' + this.values.length);
            var keys = new Array(size);
            var values = new Array(size);
            for (var i = 0; i < size; i++) {
                keys[i] = this.popValue();
                values[i] = this.popValue();
            }
            this.pushValue([keys, values]);
        };

        /// Utilities

        JavaScriptCompiler.prototype.push = function push(args) {
            while (args[args.length - 1] === null) {
                args.pop();
            }
            this.blocks.current.push(args);
        };

        JavaScriptCompiler.prototype.pushValue = function pushValue(val) {
            this.values.push(val);
        };

        JavaScriptCompiler.prototype.popValue = function popValue() {
            _glimmerUtil.assert(this.values.length, "No expression found on stack");
            return this.values.pop();
        };

        return JavaScriptCompiler;
    })();

    function isTrustedValue(value) {
        return value.escaped !== undefined && !value.escaped;
    }

    var TemplateCompiler = (function () {
        function TemplateCompiler(options) {
            this.templateId = 0;
            this.templateIds = [];
            this.symbols = null;
            this.opcodes = [];
            this.includeMeta = false;
            this.options = options || {};
        }

        TemplateCompiler.compile = function compile(options, ast) {
            var templateVisitor = new TemplateVisitor();
            templateVisitor.visit(ast);
            var compiler = new TemplateCompiler(options);
            var opcodes = compiler.process(templateVisitor.actions);
            return JavaScriptCompiler.process(opcodes, options.meta);
        };

        TemplateCompiler.prototype.process = function process(actions) {
            var _this2 = this;

            actions.forEach(function (_ref3) {
                var name = _ref3[0];

                var args = _ref3.slice(1);

                if (!_this2[name]) {
                    throw new Error('Unimplemented ' + name + ' on TemplateCompiler');
                }
                _this2[name].apply(_this2, args);
            });
            return this.opcodes;
        };

        TemplateCompiler.prototype.startProgram = function startProgram(program) {
            this.opcode('startProgram', program, program);
        };

        TemplateCompiler.prototype.endProgram = function endProgram() {
            this.opcode('endProgram', null);
        };

        TemplateCompiler.prototype.startBlock = function startBlock(program) {
            this.symbols = program[0].symbols;
            this.templateId++;
            this.opcode('startBlock', program, program);
        };

        TemplateCompiler.prototype.endBlock = function endBlock() {
            this.symbols = null;
            this.templateIds.push(this.templateId - 1);
            this.opcode('endBlock', null);
        };

        TemplateCompiler.prototype.text = function text(_ref4) {
            var action = _ref4[0];

            this.opcode('text', action, action.chars);
        };

        TemplateCompiler.prototype.comment = function comment(_ref5) {
            var action = _ref5[0];

            this.opcode('comment', action, action.value);
        };

        TemplateCompiler.prototype.openElement = function openElement(_ref6) {
            var action = _ref6[0];

            this.opcode('openElement', action, action.tag, action.blockParams);
            for (var i = 0; i < action.attributes.length; i++) {
                this.attribute([action.attributes[i]]);
            }
            for (var i = 0; i < action.modifiers.length; i++) {
                this.modifier([action.modifiers[i]]);
            }
            this.opcode('flushElement', null);
        };

        TemplateCompiler.prototype.closeElement = function closeElement(_ref7) {
            var action = _ref7[0];

            this.opcode('closeElement', null, action.tag);
        };

        TemplateCompiler.prototype.attribute = function attribute(_ref8) {
            var action = _ref8[0];
            var name = action.name;
            var value = action.value;

            var namespace = _glimmerUtil.getAttrNamespace(name);
            var isStatic = this.prepareAttributeValue(value);
            if (name.charAt(0) === '@') {
                // Arguments
                if (isStatic) {
                    this.opcode('staticArg', action, name);
                } else if (action.value.type === 'MustacheStatement') {
                    this.opcode('dynamicArg', action, name);
                } else {
                    this.opcode('dynamicArg', action, name);
                }
            } else {
                var isTrusting = isTrustedValue(value);
                if (isStatic) {
                    this.opcode('staticAttr', action, name, namespace);
                } else if (isTrusting) {
                    this.opcode('trustingAttr', action, name, namespace);
                } else if (action.value.type === 'MustacheStatement') {
                    this.opcode('dynamicAttr', action, name);
                } else {
                    this.opcode('dynamicAttr', action, name, namespace);
                }
            }
        };

        TemplateCompiler.prototype.modifier = function modifier(_ref9) {
            var action = _ref9[0];
            var parts = action.path.parts;

            this.prepareHelper(action);
            this.opcode('modifier', action, parts);
        };

        TemplateCompiler.prototype.mustache = function mustache(_ref10) {
            var action = _ref10[0];

            if (isYield(action)) {
                var to = assertValidYield(action);
                this.yield(to, action);
            } else if (isPartial(action)) {
                var params = assertValidPartial(action);
                this.partial(params, action);
            } else if (isDebugger(action)) {
                assertValidDebuggerUsage(action);
                this.debugger('debugger', action);
            } else {
                this.mustacheExpression(action);
                this.opcode('append', action, !action.escaped);
            }
        };

        TemplateCompiler.prototype.block = function block(_ref11) /*, index, count*/{
            var action = _ref11[0];

            this.prepareHelper(action);
            var templateId = this.templateIds.pop();
            var inverseId = action.inverse === null ? null : this.templateIds.pop();
            this.opcode('block', action, action.path.parts, templateId, inverseId);
        };

        /// Internal actions, not found in the original processed actions

        TemplateCompiler.prototype.arg = function arg(_ref12) {
            var path = _ref12[0];
            var parts = path.parts;

            this.opcode('arg', path, parts);
        };

        TemplateCompiler.prototype.mustacheExpression = function mustacheExpression(expr) {
            if (isBuiltInHelper(expr)) {
                this.builtInHelper(expr);
            } else if (isLiteral(expr)) {
                this.opcode('literal', expr, expr.path.value);
            } else if (isArg(expr)) {
                this.arg([expr.path]);
            } else if (isHelperInvocation(expr)) {
                this.prepareHelper(expr);
                this.opcode('helper', expr, expr.path.parts);
            } else if (isSelfGet(expr) || isLocalVariable(expr, this.symbols)) {
                this.opcode('get', expr, expr.path.parts);
            } else {
                this.opcode('unknown', expr, expr.path.parts);
            }
        };

        /// Internal Syntax

        TemplateCompiler.prototype.yield = function _yield(to, action) {
            this.prepareParams(action.params);
            this.opcode('yield', action, to);
        };

        TemplateCompiler.prototype.debugger = function _debugger(name, action) {
            this.opcode('debugger', null);
        };

        TemplateCompiler.prototype.hasBlock = function hasBlock(name, action) {
            this.opcode('hasBlock', action, name);
        };

        TemplateCompiler.prototype.hasBlockParams = function hasBlockParams(name, action) {
            this.opcode('hasBlockParams', action, name);
        };

        TemplateCompiler.prototype.partial = function partial(params, action) {
            this.prepareParams(action.params);
            this.opcode('partial', action);
        };

        TemplateCompiler.prototype.builtInHelper = function builtInHelper(expr) {
            if (isHasBlock(expr)) {
                var _name = assertValidHasBlockUsage(expr.path.original, expr);
                this.hasBlock(_name, expr);
            } else if (isHasBlockParams(expr)) {
                var _name2 = assertValidHasBlockUsage(expr.path.original, expr);
                this.hasBlockParams(_name2, expr);
            }
        };

        /// Expressions, invoked recursively from prepareParams and prepareHash

        TemplateCompiler.prototype.SubExpression = function SubExpression(expr) {
            if (isBuiltInHelper(expr)) {
                this.builtInHelper(expr);
            } else {
                this.prepareHelper(expr);
                this.opcode('helper', expr, expr.path.parts);
            }
        };

        TemplateCompiler.prototype.PathExpression = function PathExpression(expr) {
            if (expr.data) {
                this.arg([expr]);
            } else {
                this.opcode('get', expr, expr.parts);
            }
        };

        TemplateCompiler.prototype.StringLiteral = function StringLiteral(action) {
            this.opcode('literal', null, action.value);
        };

        TemplateCompiler.prototype.BooleanLiteral = function BooleanLiteral(action) {
            this.opcode('literal', null, action.value);
        };

        TemplateCompiler.prototype.NumberLiteral = function NumberLiteral(action) {
            this.opcode('literal', null, action.value);
        };

        TemplateCompiler.prototype.NullLiteral = function NullLiteral(action) {
            this.opcode('literal', null, action.value);
        };

        TemplateCompiler.prototype.UndefinedLiteral = function UndefinedLiteral(action) {
            this.opcode('literal', null, action.value);
        };

        /// Utilities

        TemplateCompiler.prototype.opcode = function opcode(name, action) {
            for (var _len = arguments.length, args = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
                args[_key - 2] = arguments[_key];
            }

            var opcode = [name].concat(args);
            if (this.includeMeta && action) {
                opcode.push(this.meta(action));
            }
            this.opcodes.push(opcode);
        };

        TemplateCompiler.prototype.prepareHelper = function prepareHelper(_ref13) {
            var params = _ref13.params;
            var hash = _ref13.hash;

            this.prepareHash(hash);
            this.prepareParams(params);
        };

        TemplateCompiler.prototype.preparePath = function preparePath(path) {
            this.opcode('literal', path, path.parts);
        };

        TemplateCompiler.prototype.prepareParams = function prepareParams(params) {
            if (!params.length) {
                this.opcode('literal', null, null);
                return;
            }
            for (var i = params.length - 1; i >= 0; i--) {
                var param = params[i];
                _glimmerUtil.assert(this[param.type], 'Unimplemented ' + param.type + ' on TemplateCompiler');
                this[param.type](param);
            }
            this.opcode('prepareArray', null, params.length);
        };

        TemplateCompiler.prototype.prepareHash = function prepareHash(hash) {
            var pairs = hash.pairs;
            if (!pairs.length) {
                this.opcode('literal', null, null);
                return;
            }
            for (var i = pairs.length - 1; i >= 0; i--) {
                var _pairs$i = pairs[i];
                var key = _pairs$i.key;
                var value = _pairs$i.value;

                _glimmerUtil.assert(this[value.type], 'Unimplemented ' + value.type + ' on TemplateCompiler');
                this[value.type](value);
                this.opcode('literal', null, key);
            }
            this.opcode('prepareObject', null, pairs.length);
        };

        TemplateCompiler.prototype.prepareAttributeValue = function prepareAttributeValue(value) {
            // returns the static value if the value is static
            switch (value.type) {
                case 'TextNode':
                    this.opcode('literal', value, value.chars);
                    return true;
                case 'MustacheStatement':
                    this.attributeMustache([value]);
                    return false;
                case 'ConcatStatement':
                    this.prepareConcatParts(value.parts);
                    this.opcode('concat', value);
                    return false;
            }
        };

        TemplateCompiler.prototype.prepareConcatParts = function prepareConcatParts(parts) {
            for (var i = parts.length - 1; i >= 0; i--) {
                var part = parts[i];
                if (part.type === 'MustacheStatement') {
                    this.attributeMustache([part]);
                } else if (part.type === 'TextNode') {
                    this.opcode('literal', null, part.chars);
                }
            }
            this.opcode('prepareArray', null, parts.length);
        };

        TemplateCompiler.prototype.attributeMustache = function attributeMustache(_ref14) {
            var action = _ref14[0];

            this.mustacheExpression(action);
        };

        TemplateCompiler.prototype.meta = function meta(node) {
            var loc = node.loc;
            if (!loc) {
                return [];
            }
            var source = loc.source;
            var start = loc.start;
            var end = loc.end;

            return ['loc', [source || null, [start.line, start.column], [end.line, end.column]]];
        };

        return TemplateCompiler;
    })();

    function isHelperInvocation(mustache) {
        return mustache.params && mustache.params.length > 0 || mustache.hash && mustache.hash.pairs.length > 0;
    }
    function isSelfGet(mustache) {
        var parts = mustache.path.parts;

        return parts[0] === null;
    }
    function isLocalVariable(mustache, symbols) {
        var parts = mustache.path.parts;

        return parts.length === 1 && symbols && symbols.hasLocalVariable(parts[0]);
    }
    function isYield(_ref15) {
        var path = _ref15.path;

        return path.original === 'yield';
    }
    function isPartial(_ref16) {
        var path = _ref16.path;

        return path.original === 'partial';
    }
    function isDebugger(_ref17) {
        var path = _ref17.path;

        return path.original === 'debugger';
    }
    function isArg(_ref18) {
        var path = _ref18.path;

        return path.data;
    }
    function isLiteral(_ref19) {
        var path = _ref19.path;

        return path.type === 'StringLiteral' || path.type === 'BooleanLiteral' || path.type === 'NumberLiteral' || path.type === 'NullLiteral' || path.type === 'UndefinedLiteral';
    }
    function isHasBlock(_ref20) {
        var path = _ref20.path;

        return path.original === 'has-block';
    }
    function isHasBlockParams(_ref21) {
        var path = _ref21.path;

        return path.original === 'has-block-params';
    }
    function isBuiltInHelper(expr) {
        return isHasBlock(expr) || isHasBlockParams(expr);
    }
    function assertValidYield(_ref22) {
        var hash = _ref22.hash;

        var pairs = hash.pairs;
        if (pairs.length === 1 && pairs[0].key !== 'to' || pairs.length > 1) {
            throw new Error('yield only takes a single named argument: \'to\'');
        } else if (pairs.length === 1 && pairs[0].value.type !== 'StringLiteral') {
            throw new Error('you can only yield to a literal value');
        } else if (pairs.length === 0) {
            return 'default';
        } else {
            return pairs[0].value.value;
        }
    }
    function assertValidPartial(_ref23) {
        var params = _ref23.params;
        var hash = _ref23.hash;
        var escaped = _ref23.escaped;
        var loc = _ref23.loc;

        if (params && params.length !== 1) {
            throw new Error('Partial found with no arguments. You must specify a template name. (on line ' + loc.start.line + ')');
        } else if (hash && hash.pairs.length > 0) {
            throw new Error('partial does not take any named arguments (on line ' + loc.start.line + ')');
        } else if (!escaped) {
            throw new Error('{{{partial ...}}} is not supported, please use {{partial ...}} instead (on line ' + loc.start.line + ')');
        }
        return params;
    }
    function assertValidHasBlockUsage(type, _ref24) {
        var params = _ref24.params;
        var hash = _ref24.hash;
        var loc = _ref24.loc;

        if (hash && hash.pairs.length > 0) {
            throw new Error(type + ' does not take any named arguments');
        }
        if (params.length === 0) {
            return 'default';
        } else if (params.length === 1) {
            if (params[0].type === 'StringLiteral') {
                return params[0].value;
            } else {
                throw new Error('you can only yield to a literal value (on line ' + loc.start.line + ')');
            }
        } else {
            throw new Error(type + ' only takes a single positional argument (on line ' + loc.start.line + ')');
        }
    }
    function assertValidDebuggerUsage(_ref25) {
        var params = _ref25.params;
        var hash = _ref25.hash;

        if (hash && hash.pairs.length > 0) {
            throw new Error('debugger does not take any named arguments');
        }
        if (params.length === 0) {
            return 'default';
        } else {
            throw new Error('debugger does not take any positional arguments');
        }
    }

    var defaultId = (function () {
        var idFn = undefined;
        return function () {
            if (!idFn) {
                if (typeof require === 'function') {
                    try {
                        (function () {
                            /* tslint:disable:no-require-imports */
                            var crypto = require('crypto');
                            /* tslint:enable:no-require-imports */
                            idFn = function (src) {
                                var hash = crypto.createHash('sha1');
                                hash.update(src, 'utf8');
                                // trim to 6 bytes of data (2^48 - 1)
                                return hash.digest('base64').substring(0, 8);
                            };
                            idFn("test");
                        })();
                    } catch (e) {
                        idFn = null;
                    }
                }
                if (!idFn) {
                    idFn = function () {
                        return null;
                    };
                }
            }
            return idFn;
        };
    })();
    function precompile(string, options) {
        var opts = options || {
            id: defaultId(),
            meta: {}
        };
        var ast = _glimmerSyntax.preprocess(string, opts);

        var _TemplateCompiler$compile = TemplateCompiler.compile(opts, ast);

        var block = _TemplateCompiler$compile.block;
        var meta = _TemplateCompiler$compile.meta;

        var idFn = opts.id || defaultId();
        var blockJSON = JSON.stringify(block.toJSON());
        var templateJSONObject = {
            id: idFn(JSON.stringify(meta) + blockJSON),
            block: blockJSON,
            meta: meta
        };
        // JSON is javascript
        return JSON.stringify(templateJSONObject);
    }

    exports.precompile = precompile;
    exports.TemplateVisitor = TemplateVisitor;
});
enifed("@glimmer/reference", ["exports", "@glimmer/util"], function (exports, _glimmerUtil) {
    "use strict";

    var CONSTANT = 0;
    var INITIAL = 1;
    var VOLATILE = NaN;

    var RevisionTag = (function () {
        function RevisionTag() {}

        RevisionTag.prototype.validate = function validate(snapshot) {
            return this.value() === snapshot;
        };

        return RevisionTag;
    })();

    var $REVISION = INITIAL;

    var DirtyableTag = (function (_RevisionTag) {
        babelHelpers.inherits(DirtyableTag, _RevisionTag);

        function DirtyableTag() {
            var revision = arguments.length <= 0 || arguments[0] === undefined ? $REVISION : arguments[0];

            _RevisionTag.call(this);
            this.revision = revision;
        }

        DirtyableTag.prototype.value = function value() {
            return this.revision;
        };

        DirtyableTag.prototype.dirty = function dirty() {
            this.revision = ++$REVISION;
        };

        return DirtyableTag;
    })(RevisionTag);

    function combineTagged(tagged) {
        var optimized = [];
        for (var i = 0, l = tagged.length; i < l; i++) {
            var tag = tagged[i].tag;
            if (tag === VOLATILE_TAG) return VOLATILE_TAG;
            if (tag === CONSTANT_TAG) continue;
            optimized.push(tag);
        }
        return _combine(optimized);
    }
    function combineSlice(slice) {
        var optimized = [];
        var node = slice.head();
        while (node !== null) {
            var tag = node.tag;
            if (tag === VOLATILE_TAG) return VOLATILE_TAG;
            if (tag !== CONSTANT_TAG) optimized.push(tag);
            node = slice.nextNode(node);
        }
        return _combine(optimized);
    }
    function combine(tags) {
        var optimized = [];
        for (var i = 0, l = tags.length; i < l; i++) {
            var tag = tags[i];
            if (tag === VOLATILE_TAG) return VOLATILE_TAG;
            if (tag === CONSTANT_TAG) continue;
            optimized.push(tag);
        }
        return _combine(optimized);
    }
    function _combine(tags) {
        switch (tags.length) {
            case 0:
                return CONSTANT_TAG;
            case 1:
                return tags[0];
            case 2:
                return new TagsPair(tags[0], tags[1]);
            default:
                return new TagsCombinator(tags);
        }
        ;
    }

    var CachedTag = (function (_RevisionTag2) {
        babelHelpers.inherits(CachedTag, _RevisionTag2);

        function CachedTag() {
            _RevisionTag2.apply(this, arguments);
            this.lastChecked = null;
            this.lastValue = null;
        }

        CachedTag.prototype.value = function value() {
            var lastChecked = this.lastChecked;
            var lastValue = this.lastValue;

            if (lastChecked !== $REVISION) {
                this.lastChecked = $REVISION;
                this.lastValue = lastValue = this.compute();
            }
            return this.lastValue;
        };

        CachedTag.prototype.invalidate = function invalidate() {
            this.lastChecked = null;
        };

        return CachedTag;
    })(RevisionTag);

    var TagsPair = (function (_CachedTag) {
        babelHelpers.inherits(TagsPair, _CachedTag);

        function TagsPair(first, second) {
            _CachedTag.call(this);
            this.first = first;
            this.second = second;
        }

        TagsPair.prototype.compute = function compute() {
            return Math.max(this.first.value(), this.second.value());
        };

        return TagsPair;
    })(CachedTag);

    var TagsCombinator = (function (_CachedTag2) {
        babelHelpers.inherits(TagsCombinator, _CachedTag2);

        function TagsCombinator(tags) {
            _CachedTag2.call(this);
            this.tags = tags;
        }

        TagsCombinator.prototype.compute = function compute() {
            var tags = this.tags;

            var max = -1;
            for (var i = 0; i < tags.length; i++) {
                var value = tags[i].value();
                max = Math.max(value, max);
            }
            return max;
        };

        return TagsCombinator;
    })(CachedTag);

    var UpdatableTag = (function (_CachedTag3) {
        babelHelpers.inherits(UpdatableTag, _CachedTag3);

        function UpdatableTag(tag) {
            _CachedTag3.call(this);
            this.tag = tag;
            this.lastUpdated = INITIAL;
        }

        //////////

        UpdatableTag.prototype.compute = function compute() {
            return Math.max(this.lastUpdated, this.tag.value());
        };

        UpdatableTag.prototype.update = function update(tag) {
            if (tag !== this.tag) {
                this.tag = tag;
                this.lastUpdated = $REVISION;
                this.invalidate();
            }
        };

        return UpdatableTag;
    })(CachedTag);

    var CONSTANT_TAG = new ((function (_RevisionTag3) {
        babelHelpers.inherits(ConstantTag, _RevisionTag3);

        function ConstantTag() {
            _RevisionTag3.apply(this, arguments);
        }

        ConstantTag.prototype.value = function value() {
            return CONSTANT;
        };

        return ConstantTag;
    })(RevisionTag))();
    var VOLATILE_TAG = new ((function (_RevisionTag4) {
        babelHelpers.inherits(VolatileTag, _RevisionTag4);

        function VolatileTag() {
            _RevisionTag4.apply(this, arguments);
        }

        VolatileTag.prototype.value = function value() {
            return VOLATILE;
        };

        return VolatileTag;
    })(RevisionTag))();
    var CURRENT_TAG = new ((function (_DirtyableTag) {
        babelHelpers.inherits(CurrentTag, _DirtyableTag);

        function CurrentTag() {
            _DirtyableTag.apply(this, arguments);
        }

        CurrentTag.prototype.value = function value() {
            return $REVISION;
        };

        return CurrentTag;
    })(DirtyableTag))();

    var CachedReference = (function () {
        function CachedReference() {
            this.lastRevision = null;
            this.lastValue = null;
        }

        CachedReference.prototype.value = function value() {
            var tag = this.tag;
            var lastRevision = this.lastRevision;
            var lastValue = this.lastValue;

            if (!lastRevision || !tag.validate(lastRevision)) {
                lastValue = this.lastValue = this.compute();
                this.lastRevision = tag.value();
            }
            return lastValue;
        };

        CachedReference.prototype.invalidate = function invalidate() {
            this.lastRevision = null;
        };

        return CachedReference;
    })();

    var MapperReference = (function (_CachedReference) {
        babelHelpers.inherits(MapperReference, _CachedReference);

        function MapperReference(reference, mapper) {
            _CachedReference.call(this);
            this.tag = reference.tag;
            this.reference = reference;
            this.mapper = mapper;
        }

        MapperReference.prototype.compute = function compute() {
            var reference = this.reference;
            var mapper = this.mapper;

            return mapper(reference.value());
        };

        return MapperReference;
    })(CachedReference);

    function map(reference, mapper) {
        return new MapperReference(reference, mapper);
    }
    //////////

    var ReferenceCache = (function () {
        function ReferenceCache(reference) {
            this.lastValue = null;
            this.lastRevision = null;
            this.initialized = false;
            this.tag = reference.tag;
            this.reference = reference;
        }

        ReferenceCache.prototype.peek = function peek() {
            if (!this.initialized) {
                return this.initialize();
            }
            return this.lastValue;
        };

        ReferenceCache.prototype.revalidate = function revalidate() {
            if (!this.initialized) {
                return this.initialize();
            }
            var reference = this.reference;
            var lastRevision = this.lastRevision;

            var tag = reference.tag;
            if (tag.validate(lastRevision)) return NOT_MODIFIED;
            this.lastRevision = tag.value();
            var lastValue = this.lastValue;

            var value = reference.value();
            if (value === lastValue) return NOT_MODIFIED;
            this.lastValue = value;
            return value;
        };

        ReferenceCache.prototype.initialize = function initialize() {
            var reference = this.reference;

            var value = this.lastValue = reference.value();
            this.lastRevision = reference.tag.value();
            this.initialized = true;
            return value;
        };

        return ReferenceCache;
    })();

    var NOT_MODIFIED = "adb3b78e-3d22-4e4b-877a-6317c2c5c145";
    function isModified(value) {
        return value !== NOT_MODIFIED;
    }

    var ConstReference = (function () {
        function ConstReference(inner) {
            this.inner = inner;
            this.tag = CONSTANT_TAG;
        }

        ConstReference.prototype.value = function value() {
            return this.inner;
        };

        return ConstReference;
    })();

    function isConst(reference) {
        return reference.tag === CONSTANT_TAG;
    }

    var ListItem = (function (_ListNode) {
        babelHelpers.inherits(ListItem, _ListNode);

        function ListItem(iterable, result) {
            _ListNode.call(this, iterable.valueReferenceFor(result));
            this.retained = false;
            this.seen = false;
            this.key = result.key;
            this.iterable = iterable;
            this.memo = iterable.memoReferenceFor(result);
        }

        ListItem.prototype.update = function update(item) {
            this.retained = true;
            this.iterable.updateValueReference(this.value, item);
            this.iterable.updateMemoReference(this.memo, item);
        };

        ListItem.prototype.shouldRemove = function shouldRemove() {
            return !this.retained;
        };

        ListItem.prototype.reset = function reset() {
            this.retained = false;
            this.seen = false;
        };

        return ListItem;
    })(_glimmerUtil.ListNode);

    var IterationArtifacts = (function () {
        function IterationArtifacts(iterable) {
            this.map = _glimmerUtil.dict();
            this.list = new _glimmerUtil.LinkedList();
            this.tag = iterable.tag;
            this.iterable = iterable;
        }

        IterationArtifacts.prototype.isEmpty = function isEmpty() {
            var iterator = this.iterator = this.iterable.iterate();
            return iterator.isEmpty();
        };

        IterationArtifacts.prototype.iterate = function iterate() {
            var iterator = this.iterator || this.iterable.iterate();
            this.iterator = null;
            return iterator;
        };

        IterationArtifacts.prototype.has = function has(key) {
            return !!this.map[key];
        };

        IterationArtifacts.prototype.get = function get(key) {
            return this.map[key];
        };

        IterationArtifacts.prototype.wasSeen = function wasSeen(key) {
            var node = this.map[key];
            return node && node.seen;
        };

        IterationArtifacts.prototype.append = function append(item) {
            var map = this.map;
            var list = this.list;
            var iterable = this.iterable;

            var node = map[item.key] = new ListItem(iterable, item);
            list.append(node);
            return node;
        };

        IterationArtifacts.prototype.insertBefore = function insertBefore(item, reference) {
            var map = this.map;
            var list = this.list;
            var iterable = this.iterable;

            var node = map[item.key] = new ListItem(iterable, item);
            node.retained = true;
            list.insertBefore(node, reference);
            return node;
        };

        IterationArtifacts.prototype.move = function move(item, reference) {
            var list = this.list;

            item.retained = true;
            list.remove(item);
            list.insertBefore(item, reference);
        };

        IterationArtifacts.prototype.remove = function remove(item) {
            var list = this.list;

            list.remove(item);
            delete this.map[item.key];
        };

        IterationArtifacts.prototype.nextNode = function nextNode(item) {
            return this.list.nextNode(item);
        };

        IterationArtifacts.prototype.head = function head() {
            return this.list.head();
        };

        return IterationArtifacts;
    })();

    var ReferenceIterator = (function () {
        // if anyone needs to construct this object with something other than
        // an iterable, let @wycats know.

        function ReferenceIterator(iterable) {
            this.iterator = null;
            var artifacts = new IterationArtifacts(iterable);
            this.artifacts = artifacts;
        }

        ReferenceIterator.prototype.next = function next() {
            var artifacts = this.artifacts;

            var iterator = this.iterator = this.iterator || artifacts.iterate();
            var item = iterator.next();
            if (!item) return null;
            return artifacts.append(item);
        };

        return ReferenceIterator;
    })();

    var Phase;
    (function (Phase) {
        Phase[Phase["Append"] = 0] = "Append";
        Phase[Phase["Prune"] = 1] = "Prune";
        Phase[Phase["Done"] = 2] = "Done";
    })(Phase || (Phase = {}));

    var IteratorSynchronizer = (function () {
        function IteratorSynchronizer(_ref) {
            var target = _ref.target;
            var artifacts = _ref.artifacts;

            this.target = target;
            this.artifacts = artifacts;
            this.iterator = artifacts.iterate();
            this.current = artifacts.head();
        }

        IteratorSynchronizer.prototype.sync = function sync() {
            var phase = Phase.Append;
            while (true) {
                switch (phase) {
                    case Phase.Append:
                        phase = this.nextAppend();
                        break;
                    case Phase.Prune:
                        phase = this.nextPrune();
                        break;
                    case Phase.Done:
                        this.nextDone();
                        return;
                }
            }
        };

        IteratorSynchronizer.prototype.advanceToKey = function advanceToKey(key) {
            var current = this.current;
            var artifacts = this.artifacts;

            var seek = current;
            while (seek && seek.key !== key) {
                seek.seen = true;
                seek = artifacts.nextNode(seek);
            }
            this.current = seek && artifacts.nextNode(seek);
        };

        IteratorSynchronizer.prototype.nextAppend = function nextAppend() {
            var iterator = this.iterator;
            var current = this.current;
            var artifacts = this.artifacts;

            var item = iterator.next();
            if (item === null) {
                return this.startPrune();
            }
            var key = item.key;

            if (current && current.key === key) {
                this.nextRetain(item);
            } else if (artifacts.has(key)) {
                this.nextMove(item);
            } else {
                this.nextInsert(item);
            }
            return Phase.Append;
        };

        IteratorSynchronizer.prototype.nextRetain = function nextRetain(item) {
            var artifacts = this.artifacts;
            var current = this.current;

            current = _glimmerUtil.expect(current, 'BUG: current is empty');
            current.update(item);
            this.current = artifacts.nextNode(current);
            this.target.retain(item.key, current.value, current.memo);
        };

        IteratorSynchronizer.prototype.nextMove = function nextMove(item) {
            var current = this.current;
            var artifacts = this.artifacts;
            var target = this.target;
            var key = item.key;

            var found = artifacts.get(item.key);
            found.update(item);
            if (artifacts.wasSeen(item.key)) {
                artifacts.move(found, current);
                target.move(found.key, found.value, found.memo, current ? current.key : null);
            } else {
                this.advanceToKey(key);
            }
        };

        IteratorSynchronizer.prototype.nextInsert = function nextInsert(item) {
            var artifacts = this.artifacts;
            var target = this.target;
            var current = this.current;

            var node = artifacts.insertBefore(item, current);
            target.insert(node.key, node.value, node.memo, current ? current.key : null);
        };

        IteratorSynchronizer.prototype.startPrune = function startPrune() {
            this.current = this.artifacts.head();
            return Phase.Prune;
        };

        IteratorSynchronizer.prototype.nextPrune = function nextPrune() {
            var artifacts = this.artifacts;
            var target = this.target;
            var current = this.current;

            if (current === null) {
                return Phase.Done;
            }
            var node = current;
            this.current = artifacts.nextNode(node);
            if (node.shouldRemove()) {
                artifacts.remove(node);
                target.delete(node.key);
            } else {
                node.reset();
            }
            return Phase.Prune;
        };

        IteratorSynchronizer.prototype.nextDone = function nextDone() {
            this.target.done();
        };

        return IteratorSynchronizer;
    })();

    function referenceFromParts(root, parts) {
        var reference = root;
        for (var i = 0; i < parts.length; i++) {
            reference = reference.get(parts[i]);
        }
        return reference;
    }

    exports.ConstReference = ConstReference;
    exports.isConst = isConst;
    exports.ListItem = ListItem;
    exports.referenceFromParts = referenceFromParts;
    exports.IterationArtifacts = IterationArtifacts;
    exports.ReferenceIterator = ReferenceIterator;
    exports.IteratorSynchronizer = IteratorSynchronizer;
    exports.CONSTANT = CONSTANT;
    exports.INITIAL = INITIAL;
    exports.VOLATILE = VOLATILE;
    exports.RevisionTag = RevisionTag;
    exports.DirtyableTag = DirtyableTag;
    exports.combineTagged = combineTagged;
    exports.combineSlice = combineSlice;
    exports.combine = combine;
    exports.CachedTag = CachedTag;
    exports.UpdatableTag = UpdatableTag;
    exports.CONSTANT_TAG = CONSTANT_TAG;
    exports.VOLATILE_TAG = VOLATILE_TAG;
    exports.CURRENT_TAG = CURRENT_TAG;
    exports.CachedReference = CachedReference;
    exports.map = map;
    exports.ReferenceCache = ReferenceCache;
    exports.isModified = isModified;
});
enifed('@glimmer/runtime',['exports','@glimmer/util','@glimmer/reference','@glimmer/wire-format'],function(exports,_glimmerUtil,_glimmerReference,_glimmerWireFormat){'use strict';var PrimitiveReference=(function(_ConstReference){babelHelpers.inherits(PrimitiveReference,_ConstReference);function PrimitiveReference(value){_ConstReference.call(this,value);}PrimitiveReference.create = function create(value){if(value === undefined){return UNDEFINED_REFERENCE;}else if(value === null){return NULL_REFERENCE;}else if(value === true){return TRUE_REFERENCE;}else if(value === false){return FALSE_REFERENCE;}else if(typeof value === 'number'){return new ValueReference(value);}else {return new StringReference(value);}};PrimitiveReference.prototype.get = function get(_key){return UNDEFINED_REFERENCE;};return PrimitiveReference;})(_glimmerReference.ConstReference);var StringReference=(function(_PrimitiveReference){babelHelpers.inherits(StringReference,_PrimitiveReference);function StringReference(){_PrimitiveReference.apply(this,arguments);this.lengthReference = null;}StringReference.prototype.get = function get(key){if(key === 'length'){var lengthReference=this.lengthReference;if(lengthReference === null){lengthReference = this.lengthReference = new ValueReference(this.inner.length);}return lengthReference;}else {return _PrimitiveReference.prototype.get.call(this,key);}};return StringReference;})(PrimitiveReference);var ValueReference=(function(_PrimitiveReference2){babelHelpers.inherits(ValueReference,_PrimitiveReference2);function ValueReference(value){_PrimitiveReference2.call(this,value);}return ValueReference;})(PrimitiveReference);var UNDEFINED_REFERENCE=new ValueReference(undefined);var NULL_REFERENCE=new ValueReference(null);var TRUE_REFERENCE=new ValueReference(true);var FALSE_REFERENCE=new ValueReference(false);var ConditionalReference=(function(){function ConditionalReference(inner){this.inner = inner;this.tag = inner.tag;}ConditionalReference.prototype.value = function value(){return this.toBool(this.inner.value());};ConditionalReference.prototype.toBool = function toBool(value){return !!value;};return ConditionalReference;})();var Constants=(function(){function Constants(){ // `0` means NULL
this.references = [];this.strings = [];this.expressions = [];this.arrays = [];this.slices = [];this.blocks = [];this.functions = [];this.others = [];this.NULL_REFERENCE = this.reference(NULL_REFERENCE);this.UNDEFINED_REFERENCE = this.reference(UNDEFINED_REFERENCE);}Constants.prototype.getReference = function getReference(value){return this.references[value - 1];};Constants.prototype.reference = function reference(value){var index=this.references.length;this.references.push(value);return index + 1;};Constants.prototype.getString = function getString(value){return this.strings[value - 1];};Constants.prototype.string = function string(value){var index=this.strings.length;this.strings.push(value);return index + 1;};Constants.prototype.getExpression = function getExpression(value){return this.expressions[value - 1];};Constants.prototype.expression = function expression(value){var index=this.expressions.length;this.expressions.push(value);return index + 1;};Constants.prototype.getArray = function getArray(value){return this.arrays[value - 1];};Constants.prototype.array = function array(values){var index=this.arrays.length;this.arrays.push(values);return index + 1;};Constants.prototype.getSlice = function getSlice(value){return this.slices[value - 1];};Constants.prototype.slice = function slice(_slice2){ // TODO: Put the entire program in one big array
var index=this.slices.length;this.slices.push(_slice2);return index + 1;};Constants.prototype.getBlock = function getBlock(value){return this.blocks[value - 1];};Constants.prototype.block = function block(_block2){var index=this.blocks.length;this.blocks.push(_block2);return index + 1;};Constants.prototype.getFunction = function getFunction(value){return this.functions[value - 1];};Constants.prototype.function = function _function(f){var index=this.functions.length;this.functions.push(f);return index + 1;};Constants.prototype.getOther = function getOther(value){return this.others[value - 1];};Constants.prototype.other = function other(_other){var index=this.others.length;this.others.push(_other);return index + 1;};return Constants;})();var AppendOpcodes=(function(){function AppendOpcodes(){this.evaluateOpcode = _glimmerUtil.fillNulls(51 /* EvaluatePartial */ + 1);}AppendOpcodes.prototype.add = function add(name,evaluate){this.evaluateOpcode[name] = evaluate;};AppendOpcodes.prototype.construct = function construct(name,_debug,op1,op2,op3){return [name | 0,(op1 || 0) | 0,(op2 || 0) | 0,(op3 || 0) | 0];};AppendOpcodes.prototype.evaluate = function evaluate(vm,opcode){_glimmerUtil.LOGGER.debug('[VM] OPCODE: ' + opcode.type);var func=this.evaluateOpcode[opcode.type];func(vm,opcode);};return AppendOpcodes;})();var APPEND_OPCODES=new AppendOpcodes();var AbstractOpcode=(function(){function AbstractOpcode(){_glimmerUtil.initializeGuid(this);}AbstractOpcode.prototype.toJSON = function toJSON(){return {guid:this._guid,type:this.type};};return AbstractOpcode;})();var UpdatingOpcode=(function(_AbstractOpcode){babelHelpers.inherits(UpdatingOpcode,_AbstractOpcode);function UpdatingOpcode(){_AbstractOpcode.apply(this,arguments);this.next = null;this.prev = null;}return UpdatingOpcode;})(AbstractOpcode);APPEND_OPCODES.add(20, /* OpenBlock */function(vm,_ref){var _getBlock=_ref.op1;var _args=_ref.op2;var inner=vm.constants.getOther(_getBlock);var rawArgs=vm.constants.getExpression(_args);var args=null;var block=inner.evaluate(vm);if(block){args = rawArgs.evaluate(vm);} // FIXME: can we avoid doing this when we don't have a block?
vm.pushCallerScope();if(block){vm.invokeBlock(block,args || null);}});APPEND_OPCODES.add(21, /* CloseBlock */function(vm){return vm.popScope();});APPEND_OPCODES.add(0, /* PushChildScope */function(vm){return vm.pushChildScope();});APPEND_OPCODES.add(1, /* PopScope */function(vm){return vm.popScope();});APPEND_OPCODES.add(2, /* PushDynamicScope */function(vm){return vm.pushDynamicScope();});APPEND_OPCODES.add(3, /* PopDynamicScope */function(vm){return vm.popDynamicScope();});APPEND_OPCODES.add(4, /* Put */function(vm,_ref2){var reference=_ref2.op1;vm.frame.setOperand(vm.constants.getReference(reference));});APPEND_OPCODES.add(5, /* EvaluatePut */function(vm,_ref3){var expression=_ref3.op1;var expr=vm.constants.getExpression(expression);vm.evaluateOperand(expr);});APPEND_OPCODES.add(6, /* PutArgs */function(vm,_ref4){var args=_ref4.op1;vm.evaluateArgs(vm.constants.getExpression(args));});APPEND_OPCODES.add(7, /* BindPositionalArgs */function(vm,_ref5){var _symbols=_ref5.op1;var symbols=vm.constants.getArray(_symbols);vm.bindPositionalArgs(symbols);});APPEND_OPCODES.add(8, /* BindNamedArgs */function(vm,_ref6){var _names=_ref6.op1;var _symbols=_ref6.op2;var names=vm.constants.getArray(_names);var symbols=vm.constants.getArray(_symbols);vm.bindNamedArgs(names,symbols);});APPEND_OPCODES.add(9, /* BindBlocks */function(vm,_ref7){var _names=_ref7.op1;var _symbols=_ref7.op2;var names=vm.constants.getArray(_names);var symbols=vm.constants.getArray(_symbols);vm.bindBlocks(names,symbols);});APPEND_OPCODES.add(10, /* BindPartialArgs */function(vm,_ref8){var symbol=_ref8.op1;vm.bindPartialArgs(symbol);});APPEND_OPCODES.add(11, /* BindCallerScope */function(vm){return vm.bindCallerScope();});APPEND_OPCODES.add(12, /* BindDynamicScope */function(vm,_ref9){var _names=_ref9.op1;var names=vm.constants.getArray(_names);vm.bindDynamicScope(names);});APPEND_OPCODES.add(13, /* Enter */function(vm,_ref10){var slice=_ref10.op1;return vm.enter(slice);});APPEND_OPCODES.add(14, /* Exit */function(vm){return vm.exit();});APPEND_OPCODES.add(15, /* Evaluate */function(vm,_ref11){var _block=_ref11.op1;var block=vm.constants.getBlock(_block);var args=vm.frame.getArgs();vm.invokeBlock(block,args);});APPEND_OPCODES.add(16, /* Jump */function(vm,_ref12){var target=_ref12.op1;return vm.goto(target);});APPEND_OPCODES.add(17, /* JumpIf */function(vm,_ref13){var target=_ref13.op1;var reference=vm.frame.getCondition();if(_glimmerReference.isConst(reference)){if(reference.value()){vm.goto(target);}}else {var cache=new _glimmerReference.ReferenceCache(reference);if(cache.peek()){vm.goto(target);}vm.updateWith(new Assert(cache));}});APPEND_OPCODES.add(18, /* JumpUnless */function(vm,_ref14){var target=_ref14.op1;var reference=vm.frame.getCondition();if(_glimmerReference.isConst(reference)){if(!reference.value()){vm.goto(target);}}else {var cache=new _glimmerReference.ReferenceCache(reference);if(!cache.peek()){vm.goto(target);}vm.updateWith(new Assert(cache));}});var ConstTest=function(ref,_env){return new _glimmerReference.ConstReference(!!ref.value());};var SimpleTest=function(ref,_env){return ref;};var EnvironmentTest=function(ref,env){return env.toConditionalReference(ref);};APPEND_OPCODES.add(19, /* Test */function(vm,_ref15){var _func=_ref15.op1;var operand=vm.frame.getOperand();var func=vm.constants.getFunction(_func);vm.frame.setCondition(func(operand,vm.env));});var Assert=(function(_UpdatingOpcode){babelHelpers.inherits(Assert,_UpdatingOpcode);function Assert(cache){_UpdatingOpcode.call(this);this.type = "assert";this.tag = cache.tag;this.cache = cache;}Assert.prototype.evaluate = function evaluate(vm){var cache=this.cache;if(_glimmerReference.isModified(cache.revalidate())){vm.throw();}};Assert.prototype.toJSON = function toJSON(){var type=this.type;var _guid=this._guid;var cache=this.cache;var expected=undefined;try{expected = JSON.stringify(cache.peek());}catch(e) {expected = String(cache.peek());}return {guid:_guid,type:type,args:[],details:{expected:expected}};};return Assert;})(UpdatingOpcode);var JumpIfNotModifiedOpcode=(function(_UpdatingOpcode2){babelHelpers.inherits(JumpIfNotModifiedOpcode,_UpdatingOpcode2);function JumpIfNotModifiedOpcode(tag,target){_UpdatingOpcode2.call(this);this.target = target;this.type = "jump-if-not-modified";this.tag = tag;this.lastRevision = tag.value();}JumpIfNotModifiedOpcode.prototype.evaluate = function evaluate(vm){var tag=this.tag;var target=this.target;var lastRevision=this.lastRevision;if(!vm.alwaysRevalidate && tag.validate(lastRevision)){vm.goto(target);}};JumpIfNotModifiedOpcode.prototype.didModify = function didModify(){this.lastRevision = this.tag.value();};JumpIfNotModifiedOpcode.prototype.toJSON = function toJSON(){return {guid:this._guid,type:this.type,args:[JSON.stringify(this.target.inspect())]};};return JumpIfNotModifiedOpcode;})(UpdatingOpcode);var DidModifyOpcode=(function(_UpdatingOpcode3){babelHelpers.inherits(DidModifyOpcode,_UpdatingOpcode3);function DidModifyOpcode(target){_UpdatingOpcode3.call(this);this.target = target;this.type = "did-modify";this.tag = _glimmerReference.CONSTANT_TAG;}DidModifyOpcode.prototype.evaluate = function evaluate(){this.target.didModify();};return DidModifyOpcode;})(UpdatingOpcode);var LabelOpcode=(function(){function LabelOpcode(label){this.tag = _glimmerReference.CONSTANT_TAG;this.type = "label";this.label = null;this.prev = null;this.next = null;_glimmerUtil.initializeGuid(this);if(label)this.label = label;}LabelOpcode.prototype.evaluate = function evaluate(){};LabelOpcode.prototype.inspect = function inspect(){return this.label + ' [' + this._guid + ']';};LabelOpcode.prototype.toJSON = function toJSON(){return {guid:this._guid,type:this.type,args:[JSON.stringify(this.inspect())]};};return LabelOpcode;})();var EMPTY_ARRAY=_glimmerUtil.HAS_NATIVE_WEAKMAP?Object.freeze([]):[];var EMPTY_DICT=_glimmerUtil.HAS_NATIVE_WEAKMAP?Object.freeze(_glimmerUtil.dict()):_glimmerUtil.dict();var CompiledPositionalArgs=(function(){function CompiledPositionalArgs(values){this.values = values;this.length = values.length;}CompiledPositionalArgs.create = function create(values){if(values.length){return new this(values);}else {return COMPILED_EMPTY_POSITIONAL_ARGS;}};CompiledPositionalArgs.empty = function empty(){return COMPILED_EMPTY_POSITIONAL_ARGS;};CompiledPositionalArgs.prototype.evaluate = function evaluate(vm){var values=this.values;var length=this.length;var references=new Array(length);for(var i=0;i < length;i++) {references[i] = values[i].evaluate(vm);}return EvaluatedPositionalArgs.create(references);};CompiledPositionalArgs.prototype.toJSON = function toJSON(){return '[' + this.values.map(function(value){return value.toJSON();}).join(", ") + ']';};return CompiledPositionalArgs;})();var COMPILED_EMPTY_POSITIONAL_ARGS=new ((function(_CompiledPositionalArgs){babelHelpers.inherits(_class,_CompiledPositionalArgs);function _class(){_CompiledPositionalArgs.call(this,EMPTY_ARRAY);}_class.prototype.evaluate = function evaluate(_vm){return EVALUATED_EMPTY_POSITIONAL_ARGS;};_class.prototype.toJSON = function toJSON(){return '<EMPTY>';};return _class;})(CompiledPositionalArgs))();var EvaluatedPositionalArgs=(function(){function EvaluatedPositionalArgs(values){this.values = values;this.tag = _glimmerReference.combineTagged(values);this.length = values.length;}EvaluatedPositionalArgs.create = function create(values){return new this(values);};EvaluatedPositionalArgs.empty = function empty(){return EVALUATED_EMPTY_POSITIONAL_ARGS;};EvaluatedPositionalArgs.prototype.at = function at(index){var values=this.values;var length=this.length;return index < length?values[index]:UNDEFINED_REFERENCE;};EvaluatedPositionalArgs.prototype.value = function value(){var values=this.values;var length=this.length;var ret=new Array(length);for(var i=0;i < length;i++) {ret[i] = values[i].value();}return ret;};return EvaluatedPositionalArgs;})();var EVALUATED_EMPTY_POSITIONAL_ARGS=new ((function(_EvaluatedPositionalArgs){babelHelpers.inherits(_class2,_EvaluatedPositionalArgs);function _class2(){_EvaluatedPositionalArgs.call(this,EMPTY_ARRAY);}_class2.prototype.at = function at(){return UNDEFINED_REFERENCE;};_class2.prototype.value = function value(){return this.values;};return _class2;})(EvaluatedPositionalArgs))();var CompiledNamedArgs=(function(){function CompiledNamedArgs(keys,values){this.keys = keys;this.values = values;this.length = keys.length;_glimmerUtil.assert(keys.length === values.length,'Keys and values do not have the same length');}CompiledNamedArgs.empty = function empty(){return COMPILED_EMPTY_NAMED_ARGS;};CompiledNamedArgs.create = function create(map){var keys=Object.keys(map);var length=keys.length;if(length > 0){var values=[];for(var i=0;i < length;i++) {values[i] = map[keys[i]];}return new this(keys,values);}else {return COMPILED_EMPTY_NAMED_ARGS;}};CompiledNamedArgs.prototype.evaluate = function evaluate(vm){var keys=this.keys;var values=this.values;var length=this.length;var evaluated=new Array(length);for(var i=0;i < length;i++) {evaluated[i] = values[i].evaluate(vm);}return new EvaluatedNamedArgs(keys,evaluated);};CompiledNamedArgs.prototype.toJSON = function toJSON(){var keys=this.keys;var values=this.values;var inner=keys.map(function(key,i){return key + ': ' + values[i].toJSON();}).join(", ");return '{' + inner + '}';};return CompiledNamedArgs;})();var COMPILED_EMPTY_NAMED_ARGS=new ((function(_CompiledNamedArgs){babelHelpers.inherits(_class3,_CompiledNamedArgs);function _class3(){_CompiledNamedArgs.call(this,EMPTY_ARRAY,EMPTY_ARRAY);}_class3.prototype.evaluate = function evaluate(_vm){return EVALUATED_EMPTY_NAMED_ARGS;};_class3.prototype.toJSON = function toJSON(){return '<EMPTY>';};return _class3;})(CompiledNamedArgs))();var EvaluatedNamedArgs=(function(){function EvaluatedNamedArgs(keys,values){var _map=arguments.length <= 2 || arguments[2] === undefined?null:arguments[2];this.keys = keys;this.values = values;this._map = _map;this.tag = _glimmerReference.combineTagged(values);this.length = keys.length;_glimmerUtil.assert(keys.length === values.length,'Keys and values do not have the same length');}EvaluatedNamedArgs.create = function create(map){var keys=Object.keys(map);var length=keys.length;if(length > 0){var values=new Array(length);for(var i=0;i < length;i++) {values[i] = map[keys[i]];}return new this(keys,values,map);}else {return EVALUATED_EMPTY_NAMED_ARGS;}};EvaluatedNamedArgs.empty = function empty(){return EVALUATED_EMPTY_NAMED_ARGS;};EvaluatedNamedArgs.prototype.get = function get(key){var keys=this.keys;var values=this.values;var index=keys.indexOf(key);return index === -1?UNDEFINED_REFERENCE:values[index];};EvaluatedNamedArgs.prototype.has = function has(key){return this.keys.indexOf(key) !== -1;};EvaluatedNamedArgs.prototype.value = function value(){var keys=this.keys;var values=this.values;var out=_glimmerUtil.dict();for(var i=0;i < keys.length;i++) {var key=keys[i];var ref=values[i];out[key] = ref.value();}return out;};babelHelpers.createClass(EvaluatedNamedArgs,[{key:'map',get:function(){var map=this._map;if(map){return map;}map = this._map = _glimmerUtil.dict();var keys=this.keys;var values=this.values;var length=this.length;for(var i=0;i < length;i++) {map[keys[i]] = values[i];}return map;}}]);return EvaluatedNamedArgs;})();var EVALUATED_EMPTY_NAMED_ARGS=new ((function(_EvaluatedNamedArgs){babelHelpers.inherits(_class4,_EvaluatedNamedArgs);function _class4(){_EvaluatedNamedArgs.call(this,EMPTY_ARRAY,EMPTY_ARRAY,EMPTY_DICT);}_class4.prototype.get = function get(){return UNDEFINED_REFERENCE;};_class4.prototype.has = function has(_key){return false;};_class4.prototype.value = function value(){return EMPTY_DICT;};return _class4;})(EvaluatedNamedArgs))();var EMPTY_BLOCKS={default:null,inverse:null};var CompiledArgs=(function(){function CompiledArgs(positional,named,blocks){this.positional = positional;this.named = named;this.blocks = blocks;this.type = "compiled-args";}CompiledArgs.create = function create(positional,named,blocks){if(positional === COMPILED_EMPTY_POSITIONAL_ARGS && named === COMPILED_EMPTY_NAMED_ARGS && blocks === EMPTY_BLOCKS){return this.empty();}else {return new this(positional,named,blocks);}};CompiledArgs.empty = function empty(){return COMPILED_EMPTY_ARGS;};CompiledArgs.prototype.evaluate = function evaluate(vm){var positional=this.positional;var named=this.named;var blocks=this.blocks;return EvaluatedArgs.create(positional.evaluate(vm),named.evaluate(vm),blocks);};return CompiledArgs;})();var COMPILED_EMPTY_ARGS=new ((function(_CompiledArgs){babelHelpers.inherits(_class5,_CompiledArgs);function _class5(){_CompiledArgs.call(this,COMPILED_EMPTY_POSITIONAL_ARGS,COMPILED_EMPTY_NAMED_ARGS,EMPTY_BLOCKS);}_class5.prototype.evaluate = function evaluate(_vm){return EMPTY_EVALUATED_ARGS;};return _class5;})(CompiledArgs))();var EvaluatedArgs=(function(){function EvaluatedArgs(positional,named,blocks){this.positional = positional;this.named = named;this.blocks = blocks;this.tag = _glimmerReference.combineTagged([positional,named]);}EvaluatedArgs.empty = function empty(){return EMPTY_EVALUATED_ARGS;};EvaluatedArgs.create = function create(positional,named,blocks){return new this(positional,named,blocks);};EvaluatedArgs.positional = function positional(values){var blocks=arguments.length <= 1 || arguments[1] === undefined?EMPTY_BLOCKS:arguments[1];return new this(EvaluatedPositionalArgs.create(values),EVALUATED_EMPTY_NAMED_ARGS,blocks);};EvaluatedArgs.named = function named(map){var blocks=arguments.length <= 1 || arguments[1] === undefined?EMPTY_BLOCKS:arguments[1];return new this(EVALUATED_EMPTY_POSITIONAL_ARGS,EvaluatedNamedArgs.create(map),blocks);};return EvaluatedArgs;})();var EMPTY_EVALUATED_ARGS=new EvaluatedArgs(EVALUATED_EMPTY_POSITIONAL_ARGS,EVALUATED_EMPTY_NAMED_ARGS,EMPTY_BLOCKS);APPEND_OPCODES.add(22, /* PutDynamicComponent */function(vm){var reference=vm.frame.getOperand();var cache=_glimmerReference.isConst(reference)?undefined:new _glimmerReference.ReferenceCache(reference);var definition=cache?cache.peek():reference.value();vm.frame.setImmediate(definition);if(cache){vm.updateWith(new Assert(cache));}});APPEND_OPCODES.add(23, /* PutComponent */function(vm,_ref16){var _component=_ref16.op1;var definition=vm.constants.getOther(_component);vm.frame.setImmediate(definition);});APPEND_OPCODES.add(24, /* OpenComponent */function(vm,_ref17){var _args=_ref17.op1;var _shadow=_ref17.op2;var rawArgs=vm.constants.getExpression(_args);var shadow=vm.constants.getBlock(_shadow);var definition=vm.frame.getImmediate();var dynamicScope=vm.pushDynamicScope();var callerScope=vm.scope();var manager=definition.manager;var args=manager.prepareArgs(definition,rawArgs.evaluate(vm),dynamicScope);var hasDefaultBlock=!!args.blocks.default; // TODO Cleanup?
var component=manager.create(vm.env,definition,args,dynamicScope,vm.getSelf(),hasDefaultBlock);var destructor=manager.getDestructor(component);if(destructor)vm.newDestroyable(destructor);var layout=manager.layoutFor(definition,component,vm.env);var selfRef=manager.getSelf(component);vm.beginCacheGroup();vm.stack().pushSimpleBlock();vm.pushRootScope(selfRef,layout.symbols);vm.invokeLayout(args,layout,callerScope,component,manager,shadow);vm.updateWith(new UpdateComponentOpcode(definition.name,component,manager,args,dynamicScope));}); // export class DidCreateElementOpcode extends Opcode {
//   public type = "did-create-element";
//   evaluate(vm: VM) {
//     let manager = vm.frame.getManager();
//     let component = vm.frame.getComponent();
//     let action = 'DidCreateElementOpcode#evaluate';
//     manager.didCreateElement(component, vm.stack().expectConstructing(action), vm.stack().expectOperations(action));
//   }
//   toJSON(): OpcodeJSON {
//     return {
//       guid: this._guid,
//       type: this.type,
//       args: ["$ARGS"]
//     };
//   }
// }
APPEND_OPCODES.add(25, /* DidCreateElement */function(vm){var manager=vm.frame.getManager();var component=vm.frame.getComponent();var action='DidCreateElementOpcode#evaluate';manager.didCreateElement(component,vm.stack().expectConstructing(action),vm.stack().expectOperations(action));}); // export class ShadowAttributesOpcode extends Opcode {
//   public type = "shadow-attributes";
//   evaluate(vm: VM) {
//     let shadow = vm.frame.getShadow();
//     vm.pushCallerScope();
//     if (!shadow) return;
//     vm.invokeBlock(shadow, EvaluatedArgs.empty());
//   }
//   toJSON(): OpcodeJSON {
//     return {
//       guid: this._guid,
//       type: this.type,
//       args: ["$ARGS"]
//     };
//   }
// }
// Slow path for non-specialized component invocations. Uses an internal
// named lookup on the args.
APPEND_OPCODES.add(26, /* ShadowAttributes */function(vm){var shadow=vm.frame.getShadow();vm.pushCallerScope();if(!shadow)return;vm.invokeBlock(shadow,EvaluatedArgs.empty());}); // export class DidRenderLayoutOpcode extends Opcode {
//   public type = "did-render-layout";
//   evaluate(vm: VM) {
//     let manager = vm.frame.getManager();
//     let component = vm.frame.getComponent();
//     let bounds = vm.stack().popBlock();
//     manager.didRenderLayout(component, bounds);
//     vm.env.didCreate(component, manager);
//     vm.updateWith(new DidUpdateLayoutOpcode(manager, component, bounds));
//   }
// }
APPEND_OPCODES.add(27, /* DidRenderLayout */function(vm){var manager=vm.frame.getManager();var component=vm.frame.getComponent();var bounds=vm.stack().popBlock();manager.didRenderLayout(component,bounds);vm.env.didCreate(component,manager);vm.updateWith(new DidUpdateLayoutOpcode(manager,component,bounds));}); // export class CloseComponentOpcode extends Opcode {
//   public type = "close-component";
//   evaluate(vm: VM) {
//     vm.popScope();
//     vm.popDynamicScope();
//     vm.commitCacheGroup();
//   }
// }
APPEND_OPCODES.add(28, /* CloseComponent */function(vm){vm.popScope();vm.popDynamicScope();vm.commitCacheGroup();});var UpdateComponentOpcode=(function(_UpdatingOpcode4){babelHelpers.inherits(UpdateComponentOpcode,_UpdatingOpcode4);function UpdateComponentOpcode(name,component,manager,args,dynamicScope){_UpdatingOpcode4.call(this);this.name = name;this.component = component;this.manager = manager;this.args = args;this.dynamicScope = dynamicScope;this.type = "update-component";var componentTag=manager.getTag(component);if(componentTag){this.tag = _glimmerReference.combine([args.tag,componentTag]);}else {this.tag = args.tag;}}UpdateComponentOpcode.prototype.evaluate = function evaluate(_vm){var component=this.component;var manager=this.manager;var args=this.args;var dynamicScope=this.dynamicScope;manager.update(component,args,dynamicScope);};UpdateComponentOpcode.prototype.toJSON = function toJSON(){return {guid:this._guid,type:this.type,args:[JSON.stringify(this.name)]};};return UpdateComponentOpcode;})(UpdatingOpcode);var DidUpdateLayoutOpcode=(function(_UpdatingOpcode5){babelHelpers.inherits(DidUpdateLayoutOpcode,_UpdatingOpcode5);function DidUpdateLayoutOpcode(manager,component,bounds){_UpdatingOpcode5.call(this);this.manager = manager;this.component = component;this.bounds = bounds;this.type = "did-update-layout";this.tag = _glimmerReference.CONSTANT_TAG;}DidUpdateLayoutOpcode.prototype.evaluate = function evaluate(vm){var manager=this.manager;var component=this.component;var bounds=this.bounds;manager.didUpdateLayout(component,bounds);vm.env.didUpdate(component,manager);};return DidUpdateLayoutOpcode;})(UpdatingOpcode);var Cursor=function Cursor(element,nextSibling){this.element = element;this.nextSibling = nextSibling;};var ConcreteBounds=(function(){function ConcreteBounds(parentNode,first,last){this.parentNode = parentNode;this.first = first;this.last = last;}ConcreteBounds.prototype.parentElement = function parentElement(){return this.parentNode;};ConcreteBounds.prototype.firstNode = function firstNode(){return this.first;};ConcreteBounds.prototype.lastNode = function lastNode(){return this.last;};return ConcreteBounds;})();var SingleNodeBounds=(function(){function SingleNodeBounds(parentNode,node){this.parentNode = parentNode;this.node = node;}SingleNodeBounds.prototype.parentElement = function parentElement(){return this.parentNode;};SingleNodeBounds.prototype.firstNode = function firstNode(){return this.node;};SingleNodeBounds.prototype.lastNode = function lastNode(){return this.node;};return SingleNodeBounds;})();function single(parent,node){return new SingleNodeBounds(parent,node);}function moveBounds(bounds,reference){var parent=bounds.parentElement();var first=bounds.firstNode();var last=bounds.lastNode();var node=first;while(node) {var next=node.nextSibling;parent.insertBefore(node,reference);if(node === last)return next;node = next;}return null;}function clear(bounds){var parent=bounds.parentElement();var first=bounds.firstNode();var last=bounds.lastNode();var node=first;while(node) {var next=node.nextSibling;parent.removeChild(node);if(node === last)return next;node = next;}return null;}function isSafeString(value){return !!value && typeof value['toHTML'] === 'function';}function isNode(value){return value !== null && typeof value === 'object' && typeof value['nodeType'] === 'number';}function isString(value){return typeof value === 'string';}var Upsert=function Upsert(bounds){this.bounds = bounds;};function cautiousInsert(dom,cursor,value){if(isString(value)){return TextUpsert.insert(dom,cursor,value);}if(isSafeString(value)){return SafeStringUpsert.insert(dom,cursor,value);}if(isNode(value)){return NodeUpsert.insert(dom,cursor,value);}throw _glimmerUtil.unreachable();}function trustingInsert(dom,cursor,value){if(isString(value)){return HTMLUpsert.insert(dom,cursor,value);}if(isNode(value)){return NodeUpsert.insert(dom,cursor,value);}throw _glimmerUtil.unreachable();}var TextUpsert=(function(_Upsert){babelHelpers.inherits(TextUpsert,_Upsert);TextUpsert.insert = function insert(dom,cursor,value){var textNode=dom.createTextNode(value);dom.insertBefore(cursor.element,textNode,cursor.nextSibling);var bounds=new SingleNodeBounds(cursor.element,textNode);return new TextUpsert(bounds,textNode);};function TextUpsert(bounds,textNode){_Upsert.call(this,bounds);this.textNode = textNode;}TextUpsert.prototype.update = function update(_dom,value){if(isString(value)){var textNode=this.textNode;textNode.nodeValue = value;return true;}else {return false;}};return TextUpsert;})(Upsert);var HTMLUpsert=(function(_Upsert2){babelHelpers.inherits(HTMLUpsert,_Upsert2);function HTMLUpsert(){_Upsert2.apply(this,arguments);}HTMLUpsert.insert = function insert(dom,cursor,value){var bounds=dom.insertHTMLBefore(cursor.element,value,cursor.nextSibling);return new HTMLUpsert(bounds);};HTMLUpsert.prototype.update = function update(dom,value){if(isString(value)){var bounds=this.bounds;var parentElement=bounds.parentElement();var nextSibling=clear(bounds);this.bounds = dom.insertHTMLBefore(parentElement,nextSibling,value);return true;}else {return false;}};return HTMLUpsert;})(Upsert);var SafeStringUpsert=(function(_Upsert3){babelHelpers.inherits(SafeStringUpsert,_Upsert3);function SafeStringUpsert(bounds,lastStringValue){_Upsert3.call(this,bounds);this.lastStringValue = lastStringValue;}SafeStringUpsert.insert = function insert(dom,cursor,value){var stringValue=value.toHTML();var bounds=dom.insertHTMLBefore(cursor.element,stringValue,cursor.nextSibling);return new SafeStringUpsert(bounds,stringValue);};SafeStringUpsert.prototype.update = function update(dom,value){if(isSafeString(value)){var stringValue=value.toHTML();if(stringValue !== this.lastStringValue){var bounds=this.bounds;var parentElement=bounds.parentElement();var nextSibling=clear(bounds);this.bounds = dom.insertHTMLBefore(parentElement,nextSibling,stringValue);this.lastStringValue = stringValue;}return true;}else {return false;}};return SafeStringUpsert;})(Upsert);var NodeUpsert=(function(_Upsert4){babelHelpers.inherits(NodeUpsert,_Upsert4);function NodeUpsert(){_Upsert4.apply(this,arguments);}NodeUpsert.insert = function insert(dom,cursor,node){dom.insertBefore(cursor.element,node,cursor.nextSibling);return new NodeUpsert(single(cursor.element,node));};NodeUpsert.prototype.update = function update(dom,value){if(isNode(value)){var bounds=this.bounds;var parentElement=bounds.parentElement();var nextSibling=clear(bounds);this.bounds = dom.insertNodeBefore(parentElement,value,nextSibling);return true;}else {return false;}};return NodeUpsert;})(Upsert);var COMPONENT_DEFINITION_BRAND='COMPONENT DEFINITION [id=e59c754e-61eb-4392-8c4a-2c0ac72bfcd4]';function isComponentDefinition(obj){return typeof obj === 'object' && obj && obj[COMPONENT_DEFINITION_BRAND];}var ComponentDefinition=function ComponentDefinition(name,manager,ComponentClass){this[COMPONENT_DEFINITION_BRAND] = true;this.name = name;this.manager = manager;this.ComponentClass = ComponentClass;};var CompiledExpression=(function(){function CompiledExpression(){}CompiledExpression.prototype.toJSON = function toJSON(){return 'UNIMPL: ' + this.type.toUpperCase();};return CompiledExpression;})();APPEND_OPCODES.add(29, /* Text */function(vm,_ref18){var text=_ref18.op1;vm.stack().appendText(vm.constants.getString(text));});APPEND_OPCODES.add(30, /* Comment */function(vm,_ref19){var text=_ref19.op1;vm.stack().appendComment(vm.constants.getString(text));});APPEND_OPCODES.add(32, /* OpenElement */function(vm,_ref20){var tag=_ref20.op1;vm.stack().openElement(vm.constants.getString(tag));});APPEND_OPCODES.add(33, /* PushRemoteElement */function(vm){var reference=vm.frame.getOperand();var cache=_glimmerReference.isConst(reference)?undefined:new _glimmerReference.ReferenceCache(reference);var element=cache?cache.peek():reference.value();vm.stack().pushRemoteElement(element);if(cache){vm.updateWith(new Assert(cache));}});APPEND_OPCODES.add(34, /* PopRemoteElement */function(vm){return vm.stack().popRemoteElement();});APPEND_OPCODES.add(35, /* OpenComponentElement */function(vm,_ref21){var _tag=_ref21.op1;var tag=vm.constants.getString(_tag);vm.stack().openElement(tag,new ComponentElementOperations(vm.env));});APPEND_OPCODES.add(36, /* OpenDynamicElement */function(vm){var tagName=vm.frame.getOperand().value();vm.stack().openElement(tagName);});var ClassList=(function(){function ClassList(){this.list = null;this.isConst = true;}ClassList.prototype.append = function append(reference){var list=this.list;var isConst$$=this.isConst;if(list === null)list = this.list = [];list.push(reference);this.isConst = isConst$$ && _glimmerReference.isConst(reference);};ClassList.prototype.toReference = function toReference(){var list=this.list;var isConst$$=this.isConst;if(!list)return NULL_REFERENCE;if(isConst$$)return PrimitiveReference.create(toClassName(list));return new ClassListReference(list);};return ClassList;})();var ClassListReference=(function(_CachedReference){babelHelpers.inherits(ClassListReference,_CachedReference);function ClassListReference(list){_CachedReference.call(this);this.list = [];this.tag = _glimmerReference.combineTagged(list);this.list = list;}ClassListReference.prototype.compute = function compute(){return toClassName(this.list);};return ClassListReference;})(_glimmerReference.CachedReference);function toClassName(list){var ret=[];for(var i=0;i < list.length;i++) {var value=list[i].value();if(value !== false && value !== null && value !== undefined)ret.push(value);}return ret.length === 0?null:ret.join(' ');}var SimpleElementOperations=(function(){function SimpleElementOperations(env){this.env = env;this.opcodes = null;this.classList = null;}SimpleElementOperations.prototype.addStaticAttribute = function addStaticAttribute(element,name,value){if(name === 'class'){this.addClass(PrimitiveReference.create(value));}else {this.env.getAppendOperations().setAttribute(element,name,value);}};SimpleElementOperations.prototype.addStaticAttributeNS = function addStaticAttributeNS(element,namespace,name,value){this.env.getAppendOperations().setAttribute(element,name,value,namespace);};SimpleElementOperations.prototype.addDynamicAttribute = function addDynamicAttribute(element,name,reference,isTrusting){if(name === 'class'){this.addClass(reference);}else {var attributeManager=this.env.attributeFor(element,name,isTrusting);var attribute=new DynamicAttribute(element,attributeManager,name,reference);this.addAttribute(attribute);}};SimpleElementOperations.prototype.addDynamicAttributeNS = function addDynamicAttributeNS(element,namespace,name,reference,isTrusting){var attributeManager=this.env.attributeFor(element,name,isTrusting,namespace);var nsAttribute=new DynamicAttribute(element,attributeManager,name,reference,namespace);this.addAttribute(nsAttribute);};SimpleElementOperations.prototype.flush = function flush(element,vm){var env=vm.env;var opcodes=this.opcodes;var classList=this.classList;for(var i=0;opcodes && i < opcodes.length;i++) {vm.updateWith(opcodes[i]);}if(classList){var attributeManager=env.attributeFor(element,'class',false);var attribute=new DynamicAttribute(element,attributeManager,'class',classList.toReference());var opcode=attribute.flush(env);if(opcode){vm.updateWith(opcode);}}this.opcodes = null;this.classList = null;};SimpleElementOperations.prototype.addClass = function addClass(reference){var classList=this.classList;if(!classList){classList = this.classList = new ClassList();}classList.append(reference);};SimpleElementOperations.prototype.addAttribute = function addAttribute(attribute){var opcode=attribute.flush(this.env);if(opcode){var opcodes=this.opcodes;if(!opcodes){opcodes = this.opcodes = [];}opcodes.push(opcode);}};return SimpleElementOperations;})();var ComponentElementOperations=(function(){function ComponentElementOperations(env){this.env = env;this.attributeNames = null;this.attributes = null;this.classList = null;}ComponentElementOperations.prototype.addStaticAttribute = function addStaticAttribute(element,name,value){if(name === 'class'){this.addClass(PrimitiveReference.create(value));}else if(this.shouldAddAttribute(name)){this.addAttribute(name,new StaticAttribute(element,name,value));}};ComponentElementOperations.prototype.addStaticAttributeNS = function addStaticAttributeNS(element,namespace,name,value){if(this.shouldAddAttribute(name)){this.addAttribute(name,new StaticAttribute(element,name,value,namespace));}};ComponentElementOperations.prototype.addDynamicAttribute = function addDynamicAttribute(element,name,reference,isTrusting){if(name === 'class'){this.addClass(reference);}else if(this.shouldAddAttribute(name)){var attributeManager=this.env.attributeFor(element,name,isTrusting);var attribute=new DynamicAttribute(element,attributeManager,name,reference);this.addAttribute(name,attribute);}};ComponentElementOperations.prototype.addDynamicAttributeNS = function addDynamicAttributeNS(element,namespace,name,reference,isTrusting){if(this.shouldAddAttribute(name)){var attributeManager=this.env.attributeFor(element,name,isTrusting,namespace);var nsAttribute=new DynamicAttribute(element,attributeManager,name,reference,namespace);this.addAttribute(name,nsAttribute);}};ComponentElementOperations.prototype.flush = function flush(element,vm){var env=this.env;var attributes=this.attributes;var classList=this.classList;for(var i=0;attributes && i < attributes.length;i++) {var opcode=attributes[i].flush(env);if(opcode){vm.updateWith(opcode);}}if(classList){var attributeManager=env.attributeFor(element,'class',false);var attribute=new DynamicAttribute(element,attributeManager,'class',classList.toReference());var opcode=attribute.flush(env);if(opcode){vm.updateWith(opcode);}}};ComponentElementOperations.prototype.shouldAddAttribute = function shouldAddAttribute(name){return !this.attributeNames || this.attributeNames.indexOf(name) === -1;};ComponentElementOperations.prototype.addClass = function addClass(reference){var classList=this.classList;if(!classList){classList = this.classList = new ClassList();}classList.append(reference);};ComponentElementOperations.prototype.addAttribute = function addAttribute(name,attribute){var attributeNames=this.attributeNames;var attributes=this.attributes;if(!attributeNames){attributeNames = this.attributeNames = [];attributes = this.attributes = [];}attributeNames.push(name);_glimmerUtil.unwrap(attributes).push(attribute);};return ComponentElementOperations;})();APPEND_OPCODES.add(37, /* FlushElement */function(vm){var stack=vm.stack();var action='FlushElementOpcode#evaluate';stack.expectOperations(action).flush(stack.expectConstructing(action),vm);stack.flushElement();});APPEND_OPCODES.add(38, /* CloseElement */function(vm){return vm.stack().closeElement();});APPEND_OPCODES.add(39, /* PopElement */function(vm){return vm.stack().popElement();});APPEND_OPCODES.add(40, /* StaticAttr */function(vm,_ref22){var _name=_ref22.op1;var _value=_ref22.op2;var _namespace=_ref22.op3;var name=vm.constants.getString(_name);var value=vm.constants.getString(_value);if(_namespace){var namespace=vm.constants.getString(_namespace);vm.stack().setStaticAttributeNS(namespace,name,value);}else {vm.stack().setStaticAttribute(name,value);}});APPEND_OPCODES.add(41, /* Modifier */function(vm,_ref23){var _name=_ref23.op1;var _manager=_ref23.op2;var _args=_ref23.op3;var manager=vm.constants.getOther(_manager);var rawArgs=vm.constants.getExpression(_args);var stack=vm.stack();var element=stack.constructing;var updateOperations=stack.updateOperations;var args=rawArgs.evaluate(vm);var dynamicScope=vm.dynamicScope();var modifier=manager.create(element,args,dynamicScope,updateOperations);vm.env.scheduleInstallModifier(modifier,manager);var destructor=manager.getDestructor(modifier);if(destructor){vm.newDestroyable(destructor);}vm.updateWith(new UpdateModifierOpcode(manager,modifier,args));});var UpdateModifierOpcode=(function(_UpdatingOpcode6){babelHelpers.inherits(UpdateModifierOpcode,_UpdatingOpcode6);function UpdateModifierOpcode(manager,modifier,args){_UpdatingOpcode6.call(this);this.manager = manager;this.modifier = modifier;this.args = args;this.type = "update-modifier";this.tag = args.tag;this.lastUpdated = args.tag.value();}UpdateModifierOpcode.prototype.evaluate = function evaluate(vm){var manager=this.manager;var modifier=this.modifier;var tag=this.tag;var lastUpdated=this.lastUpdated;if(!tag.validate(lastUpdated)){vm.env.scheduleUpdateModifier(modifier,manager);this.lastUpdated = tag.value();}};UpdateModifierOpcode.prototype.toJSON = function toJSON(){return {guid:this._guid,type:this.type,args:[JSON.stringify(this.args)]};};return UpdateModifierOpcode;})(UpdatingOpcode);var StaticAttribute=(function(){function StaticAttribute(element,name,value,namespace){this.element = element;this.name = name;this.value = value;this.namespace = namespace;}StaticAttribute.prototype.flush = function flush(env){env.getAppendOperations().setAttribute(this.element,this.name,this.value,this.namespace);return null;};return StaticAttribute;})();var DynamicAttribute=(function(){function DynamicAttribute(element,attributeManager,name,reference,namespace){this.element = element;this.attributeManager = attributeManager;this.name = name;this.reference = reference;this.namespace = namespace;this.cache = null;this.tag = reference.tag;}DynamicAttribute.prototype.patch = function patch(env){var element=this.element;var cache=this.cache;var value=_glimmerUtil.expect(cache,'must patch after flush').revalidate();if(_glimmerReference.isModified(value)){this.attributeManager.updateAttribute(env,element,value,this.namespace);}};DynamicAttribute.prototype.flush = function flush(env){var reference=this.reference;var element=this.element;if(_glimmerReference.isConst(reference)){var value=reference.value();this.attributeManager.setAttribute(env,element,value,this.namespace);return null;}else {var cache=this.cache = new _glimmerReference.ReferenceCache(reference);var value=cache.peek();this.attributeManager.setAttribute(env,element,value,this.namespace);return new PatchElementOpcode(this);}};DynamicAttribute.prototype.toJSON = function toJSON(){var element=this.element;var namespace=this.namespace;var name=this.name;var cache=this.cache;var formattedElement=formatElement(element);var lastValue=_glimmerUtil.expect(cache,'must serialize after flush').peek();if(namespace){return {element:formattedElement,type:'attribute',namespace:namespace,name:name,lastValue:lastValue};}return {element:formattedElement,type:'attribute',namespace:namespace === undefined?null:namespace,name:name,lastValue:lastValue};};return DynamicAttribute;})();function formatElement(element){return JSON.stringify('<' + element.tagName.toLowerCase() + ' />');}APPEND_OPCODES.add(42, /* DynamicAttrNS */function(vm,_ref24){var _name=_ref24.op1;var _namespace=_ref24.op2;var trusting=_ref24.op3;var name=vm.constants.getString(_name);var namespace=vm.constants.getString(_namespace);var reference=vm.frame.getOperand();vm.stack().setDynamicAttributeNS(namespace,name,reference,!!trusting);});APPEND_OPCODES.add(43, /* DynamicAttr */function(vm,_ref25){var _name=_ref25.op1;var trusting=_ref25.op2;var name=vm.constants.getString(_name);var reference=vm.frame.getOperand();vm.stack().setDynamicAttribute(name,reference,!!trusting);});var PatchElementOpcode=(function(_UpdatingOpcode7){babelHelpers.inherits(PatchElementOpcode,_UpdatingOpcode7);function PatchElementOpcode(operation){_UpdatingOpcode7.call(this);this.type = "patch-element";this.tag = operation.tag;this.operation = operation;}PatchElementOpcode.prototype.evaluate = function evaluate(vm){this.operation.patch(vm.env);};PatchElementOpcode.prototype.toJSON = function toJSON(){var _guid=this._guid;var type=this.type;var operation=this.operation;return {guid:_guid,type:type,details:operation.toJSON()};};return PatchElementOpcode;})(UpdatingOpcode);var First=(function(){function First(node){this.node = node;}First.prototype.firstNode = function firstNode(){return this.node;};return First;})();var Last=(function(){function Last(node){this.node = node;}Last.prototype.lastNode = function lastNode(){return this.node;};return Last;})();var Fragment=(function(){function Fragment(bounds){this.bounds = bounds;}Fragment.prototype.parentElement = function parentElement(){return this.bounds.parentElement();};Fragment.prototype.firstNode = function firstNode(){return this.bounds.firstNode();};Fragment.prototype.lastNode = function lastNode(){return this.bounds.lastNode();};Fragment.prototype.update = function update(bounds){this.bounds = bounds;};return Fragment;})();var ElementStack=(function(){function ElementStack(env,parentNode,nextSibling){this.constructing = null;this.operations = null;this.elementStack = new _glimmerUtil.Stack();this.nextSiblingStack = new _glimmerUtil.Stack();this.blockStack = new _glimmerUtil.Stack();this.env = env;this.dom = env.getAppendOperations();this.updateOperations = env.getDOM();this.element = parentNode;this.nextSibling = nextSibling;this.defaultOperations = new SimpleElementOperations(env);this.elementStack.push(this.element);this.nextSiblingStack.push(this.nextSibling);}ElementStack.forInitialRender = function forInitialRender(env,parentNode,nextSibling){return new ElementStack(env,parentNode,nextSibling);};ElementStack.resume = function resume(env,tracker,nextSibling){var parentNode=tracker.parentElement();var stack=new ElementStack(env,parentNode,nextSibling);stack.pushBlockTracker(tracker);return stack;};ElementStack.prototype.expectConstructing = function expectConstructing(method){return _glimmerUtil.expect(this.constructing,method + ' should only be called while constructing an element');};ElementStack.prototype.expectOperations = function expectOperations(method){return _glimmerUtil.expect(this.operations,method + ' should only be called while constructing an element');};ElementStack.prototype.block = function block(){return _glimmerUtil.expect(this.blockStack.current,"Expected a current block tracker");};ElementStack.prototype.popElement = function popElement(){var elementStack=this.elementStack;var nextSiblingStack=this.nextSiblingStack;var topElement=elementStack.pop();nextSiblingStack.pop();_glimmerUtil.LOGGER.debug('-> element stack ' + this.elementStack.toArray().map(function(e){return e.tagName;}).join(', '));this.element = _glimmerUtil.expect(elementStack.current,"can't pop past the last element");this.nextSibling = nextSiblingStack.current;return topElement;};ElementStack.prototype.pushSimpleBlock = function pushSimpleBlock(){var tracker=new SimpleBlockTracker(this.element);this.pushBlockTracker(tracker);return tracker;};ElementStack.prototype.pushUpdatableBlock = function pushUpdatableBlock(){var tracker=new UpdatableBlockTracker(this.element);this.pushBlockTracker(tracker);return tracker;};ElementStack.prototype.pushBlockTracker = function pushBlockTracker(tracker){var isRemote=arguments.length <= 1 || arguments[1] === undefined?false:arguments[1];var current=this.blockStack.current;if(current !== null){current.newDestroyable(tracker);if(!isRemote){current.newBounds(tracker);}}this.blockStack.push(tracker);return tracker;};ElementStack.prototype.pushBlockList = function pushBlockList(list){var tracker=new BlockListTracker(this.element,list);var current=this.blockStack.current;if(current !== null){current.newDestroyable(tracker);current.newBounds(tracker);}this.blockStack.push(tracker);return tracker;};ElementStack.prototype.popBlock = function popBlock(){this.block().finalize(this);return _glimmerUtil.expect(this.blockStack.pop(),"Expected popBlock to return a block");};ElementStack.prototype.openElement = function openElement(tag){var operations=arguments.length <= 1 || arguments[1] === undefined?this.defaultOperations:arguments[1];var element=this.dom.createElement(tag,this.element);this.constructing = element;this.operations = operations;return element;};ElementStack.prototype.flushElement = function flushElement(){var parent=this.element;var element=_glimmerUtil.expect(this.constructing,'flushElement should only be called when constructing an element');this.dom.insertBefore(parent,element,this.nextSibling);this.constructing = null;this.operations = null;this.pushElement(element);this.block().openElement(element);};ElementStack.prototype.pushRemoteElement = function pushRemoteElement(element){this.pushElement(element);var tracker=new RemoteBlockTracker(element);this.pushBlockTracker(tracker,true);};ElementStack.prototype.popRemoteElement = function popRemoteElement(){this.popBlock();this.popElement();};ElementStack.prototype.pushElement = function pushElement(element){this.element = element;this.elementStack.push(element);_glimmerUtil.LOGGER.debug('-> element stack ' + this.elementStack.toArray().map(function(e){return e.tagName;}).join(', '));this.nextSibling = null;this.nextSiblingStack.push(null);};ElementStack.prototype.newDestroyable = function newDestroyable(d){this.block().newDestroyable(d);};ElementStack.prototype.newBounds = function newBounds(bounds){this.block().newBounds(bounds);};ElementStack.prototype.appendText = function appendText(string){var dom=this.dom;var text=dom.createTextNode(string);dom.insertBefore(this.element,text,this.nextSibling);this.block().newNode(text);return text;};ElementStack.prototype.appendComment = function appendComment(string){var dom=this.dom;var comment=dom.createComment(string);dom.insertBefore(this.element,comment,this.nextSibling);this.block().newNode(comment);return comment;};ElementStack.prototype.setStaticAttribute = function setStaticAttribute(name,value){this.expectOperations('setStaticAttribute').addStaticAttribute(this.expectConstructing('setStaticAttribute'),name,value);};ElementStack.prototype.setStaticAttributeNS = function setStaticAttributeNS(namespace,name,value){this.expectOperations('setStaticAttributeNS').addStaticAttributeNS(this.expectConstructing('setStaticAttributeNS'),namespace,name,value);};ElementStack.prototype.setDynamicAttribute = function setDynamicAttribute(name,reference,isTrusting){this.expectOperations('setDynamicAttribute').addDynamicAttribute(this.expectConstructing('setDynamicAttribute'),name,reference,isTrusting);};ElementStack.prototype.setDynamicAttributeNS = function setDynamicAttributeNS(namespace,name,reference,isTrusting){this.expectOperations('setDynamicAttributeNS').addDynamicAttributeNS(this.expectConstructing('setDynamicAttributeNS'),namespace,name,reference,isTrusting);};ElementStack.prototype.closeElement = function closeElement(){this.block().closeElement();this.popElement();};return ElementStack;})();var SimpleBlockTracker=(function(){function SimpleBlockTracker(parent){this.parent = parent;this.first = null;this.last = null;this.destroyables = null;this.nesting = 0;}SimpleBlockTracker.prototype.destroy = function destroy(){var destroyables=this.destroyables;if(destroyables && destroyables.length){for(var i=0;i < destroyables.length;i++) {destroyables[i].destroy();}}};SimpleBlockTracker.prototype.parentElement = function parentElement(){return this.parent;};SimpleBlockTracker.prototype.firstNode = function firstNode(){return this.first && this.first.firstNode();};SimpleBlockTracker.prototype.lastNode = function lastNode(){return this.last && this.last.lastNode();};SimpleBlockTracker.prototype.openElement = function openElement(element){this.newNode(element);this.nesting++;};SimpleBlockTracker.prototype.closeElement = function closeElement(){this.nesting--;};SimpleBlockTracker.prototype.newNode = function newNode(node){if(this.nesting !== 0)return;if(!this.first){this.first = new First(node);}this.last = new Last(node);};SimpleBlockTracker.prototype.newBounds = function newBounds(bounds){if(this.nesting !== 0)return;if(!this.first){this.first = bounds;}this.last = bounds;};SimpleBlockTracker.prototype.newDestroyable = function newDestroyable(d){this.destroyables = this.destroyables || [];this.destroyables.push(d);};SimpleBlockTracker.prototype.finalize = function finalize(stack){if(!this.first){stack.appendComment('');}};return SimpleBlockTracker;})();var RemoteBlockTracker=(function(_SimpleBlockTracker){babelHelpers.inherits(RemoteBlockTracker,_SimpleBlockTracker);function RemoteBlockTracker(){_SimpleBlockTracker.apply(this,arguments);}RemoteBlockTracker.prototype.destroy = function destroy(){_SimpleBlockTracker.prototype.destroy.call(this);clear(this);};return RemoteBlockTracker;})(SimpleBlockTracker);var UpdatableBlockTracker=(function(_SimpleBlockTracker2){babelHelpers.inherits(UpdatableBlockTracker,_SimpleBlockTracker2);function UpdatableBlockTracker(){_SimpleBlockTracker2.apply(this,arguments);}UpdatableBlockTracker.prototype.reset = function reset(env){var destroyables=this.destroyables;if(destroyables && destroyables.length){for(var i=0;i < destroyables.length;i++) {env.didDestroy(destroyables[i]);}}var nextSibling=clear(this);this.destroyables = null;this.first = null;this.last = null;return nextSibling;};return UpdatableBlockTracker;})(SimpleBlockTracker);var BlockListTracker=(function(){function BlockListTracker(parent,boundList){this.parent = parent;this.boundList = boundList;this.parent = parent;this.boundList = boundList;}BlockListTracker.prototype.destroy = function destroy(){this.boundList.forEachNode(function(node){return node.destroy();});};BlockListTracker.prototype.parentElement = function parentElement(){return this.parent;};BlockListTracker.prototype.firstNode = function firstNode(){var head=this.boundList.head();return head && head.firstNode();};BlockListTracker.prototype.lastNode = function lastNode(){var tail=this.boundList.tail();return tail && tail.lastNode();};BlockListTracker.prototype.openElement = function openElement(_element){_glimmerUtil.assert(false,'Cannot openElement directly inside a block list');};BlockListTracker.prototype.closeElement = function closeElement(){_glimmerUtil.assert(false,'Cannot closeElement directly inside a block list');};BlockListTracker.prototype.newNode = function newNode(_node){_glimmerUtil.assert(false,'Cannot create a new node directly inside a block list');};BlockListTracker.prototype.newBounds = function newBounds(_bounds){};BlockListTracker.prototype.newDestroyable = function newDestroyable(_d){};BlockListTracker.prototype.finalize = function finalize(_stack){};return BlockListTracker;})();var CompiledValue=(function(_CompiledExpression){babelHelpers.inherits(CompiledValue,_CompiledExpression);function CompiledValue(value){_CompiledExpression.call(this);this.type = "value";this.reference = PrimitiveReference.create(value);}CompiledValue.prototype.evaluate = function evaluate(_vm){return this.reference;};CompiledValue.prototype.toJSON = function toJSON(){return JSON.stringify(this.reference.value());};return CompiledValue;})(CompiledExpression);var CompiledHasBlock=(function(_CompiledExpression2){babelHelpers.inherits(CompiledHasBlock,_CompiledExpression2);function CompiledHasBlock(inner){_CompiledExpression2.call(this);this.inner = inner;this.type = "has-block";}CompiledHasBlock.prototype.evaluate = function evaluate(vm){var block=this.inner.evaluate(vm);return PrimitiveReference.create(!!block);};CompiledHasBlock.prototype.toJSON = function toJSON(){return 'has-block(' + this.inner.toJSON() + ')';};return CompiledHasBlock;})(CompiledExpression);var CompiledHasBlockParams=(function(_CompiledExpression3){babelHelpers.inherits(CompiledHasBlockParams,_CompiledExpression3);function CompiledHasBlockParams(inner){_CompiledExpression3.call(this);this.inner = inner;this.type = "has-block-params";}CompiledHasBlockParams.prototype.evaluate = function evaluate(vm){var block=this.inner.evaluate(vm);var hasLocals=block && block.symbolTable.getSymbols().locals;return PrimitiveReference.create(!!hasLocals);};CompiledHasBlockParams.prototype.toJSON = function toJSON(){return 'has-block-params(' + this.inner.toJSON() + ')';};return CompiledHasBlockParams;})(CompiledExpression);var CompiledGetBlockBySymbol=(function(){function CompiledGetBlockBySymbol(symbol,debug){this.symbol = symbol;this.debug = debug;}CompiledGetBlockBySymbol.prototype.evaluate = function evaluate(vm){return vm.scope().getBlock(this.symbol);};CompiledGetBlockBySymbol.prototype.toJSON = function toJSON(){return 'get-block($' + this.symbol + '(' + this.debug + '))';};return CompiledGetBlockBySymbol;})();var CompiledInPartialGetBlock=(function(){function CompiledInPartialGetBlock(symbol,name){this.symbol = symbol;this.name = name;}CompiledInPartialGetBlock.prototype.evaluate = function evaluate(vm){var symbol=this.symbol;var name=this.name;var args=vm.scope().getPartialArgs(symbol);return args.blocks[name];};CompiledInPartialGetBlock.prototype.toJSON = function toJSON(){return 'get-block($' + this.symbol + '($ARGS).' + this.name + '))';};return CompiledInPartialGetBlock;})();var CompiledLookup=(function(_CompiledExpression4){babelHelpers.inherits(CompiledLookup,_CompiledExpression4);function CompiledLookup(base,path){_CompiledExpression4.call(this);this.base = base;this.path = path;this.type = "lookup";}CompiledLookup.create = function create(base,path){if(path.length === 0){return base;}else {return new this(base,path);}};CompiledLookup.prototype.evaluate = function evaluate(vm){var base=this.base;var path=this.path;return _glimmerReference.referenceFromParts(base.evaluate(vm),path);};CompiledLookup.prototype.toJSON = function toJSON(){return this.base.toJSON() + '.' + this.path.join('.');};return CompiledLookup;})(CompiledExpression);var CompiledSelf=(function(_CompiledExpression5){babelHelpers.inherits(CompiledSelf,_CompiledExpression5);function CompiledSelf(){_CompiledExpression5.apply(this,arguments);}CompiledSelf.prototype.evaluate = function evaluate(vm){return vm.getSelf();};CompiledSelf.prototype.toJSON = function toJSON(){return 'self';};return CompiledSelf;})(CompiledExpression);var CompiledSymbol=(function(_CompiledExpression6){babelHelpers.inherits(CompiledSymbol,_CompiledExpression6);function CompiledSymbol(symbol,debug){_CompiledExpression6.call(this);this.symbol = symbol;this.debug = debug;}CompiledSymbol.prototype.evaluate = function evaluate(vm){return vm.referenceForSymbol(this.symbol);};CompiledSymbol.prototype.toJSON = function toJSON(){return '$' + this.symbol + '(' + this.debug + ')';};return CompiledSymbol;})(CompiledExpression);var CompiledInPartialName=(function(_CompiledExpression7){babelHelpers.inherits(CompiledInPartialName,_CompiledExpression7);function CompiledInPartialName(symbol,name){_CompiledExpression7.call(this);this.symbol = symbol;this.name = name;}CompiledInPartialName.prototype.evaluate = function evaluate(vm){var symbol=this.symbol;var name=this.name;var args=vm.scope().getPartialArgs(symbol);return args.named.get(name);};CompiledInPartialName.prototype.toJSON = function toJSON(){return '$' + this.symbol + '($ARGS).' + this.name;};return CompiledInPartialName;})(CompiledExpression);var CompiledHelper=(function(_CompiledExpression8){babelHelpers.inherits(CompiledHelper,_CompiledExpression8);function CompiledHelper(name,helper,args,symbolTable){_CompiledExpression8.call(this);this.name = name;this.helper = helper;this.args = args;this.symbolTable = symbolTable;this.type = "helper";}CompiledHelper.prototype.evaluate = function evaluate(vm){var helper=this.helper;return helper(vm,this.args.evaluate(vm),this.symbolTable);};CompiledHelper.prototype.toJSON = function toJSON(){return '`' + this.name.join('.') + '($ARGS)`';};return CompiledHelper;})(CompiledExpression);var CompiledConcat=(function(){function CompiledConcat(parts){this.parts = parts;this.type = "concat";}CompiledConcat.prototype.evaluate = function evaluate(vm){var parts=new Array(this.parts.length);for(var i=0;i < this.parts.length;i++) {parts[i] = this.parts[i].evaluate(vm);}return new ConcatReference(parts);};CompiledConcat.prototype.toJSON = function toJSON(){return 'concat(' + this.parts.map(function(expr){return expr.toJSON();}).join(", ") + ')';};return CompiledConcat;})();var ConcatReference=(function(_CachedReference2){babelHelpers.inherits(ConcatReference,_CachedReference2);function ConcatReference(parts){_CachedReference2.call(this);this.parts = parts;this.tag = _glimmerReference.combineTagged(parts);}ConcatReference.prototype.compute = function compute(){var parts=new Array();for(var i=0;i < this.parts.length;i++) {var value=this.parts[i].value();if(value !== null && value !== undefined){parts[i] = castToString(value);}}if(parts.length > 0){return parts.join('');}return null;};return ConcatReference;})(_glimmerReference.CachedReference);function castToString(value){if(typeof value['toString'] !== 'function'){return '';}return String(value);}var CompiledFunctionExpression=(function(_CompiledExpression9){babelHelpers.inherits(CompiledFunctionExpression,_CompiledExpression9);function CompiledFunctionExpression(func,symbolTable){_CompiledExpression9.call(this);this.func = func;this.symbolTable = symbolTable;this.type = "function";this.func = func;}CompiledFunctionExpression.prototype.evaluate = function evaluate(vm){var func=this.func;var symbolTable=this.symbolTable;return func(vm,symbolTable);};CompiledFunctionExpression.prototype.toJSON = function toJSON(){var func=this.func;if(func.name){return '`' + func.name + '(...)`';}else {return "`func(...)`";}};return CompiledFunctionExpression;})(CompiledExpression);function debugCallback(context,get){console.info('Use `context`, and `get(<path>)` to debug this template.'); /* tslint:disable */debugger; /* tslint:enable */return {context:context,get:get};}function getter(vm,builder){return function(path){var parts=path.split('.');if(parts[0] === 'this'){parts[0] = null;}return compileRef(parts,builder).evaluate(vm);};}var callback=debugCallback; // For testing purposes
function setDebuggerCallback(cb){callback = cb;}function resetDebuggerCallback(){callback = debugCallback;}var Compilers=(function(){function Compilers(){this.names = _glimmerUtil.dict();this.funcs = [];}Compilers.prototype.add = function add(name,func){this.funcs.push(func);this.names[name] = this.funcs.length - 1;};Compilers.prototype.compile = function compile(sexp,builder){var name=sexp[0];var index=this.names[name];var func=this.funcs[index];_glimmerUtil.assert(!!func,'expected an implementation for ' + sexp[0]);return func(sexp,builder);};return Compilers;})();var STATEMENTS=new Compilers();STATEMENTS.add('text',function(sexp,builder){builder.text(sexp[1]);});STATEMENTS.add('comment',function(sexp,builder){builder.comment(sexp[1]);});STATEMENTS.add('close-element',function(_sexp,builder){_glimmerUtil.LOGGER.trace('close-element statement');builder.closeElement();});STATEMENTS.add('flush-element',function(_sexp,builder){builder.flushElement();});STATEMENTS.add('modifier',function(sexp,builder){var path=sexp[1];var params=sexp[2];var hash=sexp[3];var args=compileArgs(params,hash,builder);if(builder.env.hasModifier(path,builder.symbolTable)){builder.modifier(path[0],args);}else {throw new Error('Compile Error ' + path.join('.') + ' is not a modifier: Helpers may not be used in the element form.');}});STATEMENTS.add('static-attr',function(sexp,builder){var name=sexp[1];var value=sexp[2];var namespace=sexp[3];builder.staticAttr(name,namespace,value);});STATEMENTS.add('any-dynamic-attr',function(sexp,builder){var name=sexp[1];var value=sexp[2];var namespace=sexp[3];var trusting=sexp[4];builder.putValue(value);if(namespace){builder.dynamicAttrNS(name,namespace,trusting);}else {builder.dynamicAttr(name,trusting);}});STATEMENTS.add('open-element',function(sexp,builder){_glimmerUtil.LOGGER.trace('open-element statement');builder.openPrimitiveElement(sexp[1]);});STATEMENTS.add('optimized-append',function(sexp,builder){var value=sexp[1];var trustingMorph=sexp[2];var _builder$env$macros=builder.env.macros();var inlines=_builder$env$macros.inlines;var returned=inlines.compile(sexp,builder) || value;if(returned === true)return;builder.putValue(returned[1]);if(trustingMorph){builder.trustingAppend();}else {builder.cautiousAppend();}});STATEMENTS.add('unoptimized-append',function(sexp,builder){var value=sexp[1];var trustingMorph=sexp[2];var _builder$env$macros2=builder.env.macros();var inlines=_builder$env$macros2.inlines;var returned=inlines.compile(sexp,builder) || value;if(returned === true)return;if(trustingMorph){builder.guardedTrustingAppend(returned[1]);}else {builder.guardedCautiousAppend(returned[1]);}});STATEMENTS.add('nested-block',function(sexp,builder){var _builder$env$macros3=builder.env.macros();var blocks=_builder$env$macros3.blocks;blocks.compile(sexp,builder);});STATEMENTS.add('scanned-block',function(sexp,builder){var path=sexp[1];var params=sexp[2];var hash=sexp[3];var template=sexp[4];var inverse=sexp[5];var templateBlock=template && template.scan();var inverseBlock=inverse && inverse.scan();var _builder$env$macros4=builder.env.macros();var blocks=_builder$env$macros4.blocks;blocks.compile(['nested-block',path,params,hash,templateBlock,inverseBlock],builder);});STATEMENTS.add('scanned-component',function(sexp,builder){var tag=sexp[1];var attrs=sexp[2];var rawArgs=sexp[3];var rawBlock=sexp[4];var block=rawBlock && rawBlock.scan();var args=compileBlockArgs(null,rawArgs,{default:block,inverse:null},builder);var definition=builder.env.getComponentDefinition([tag],builder.symbolTable);builder.putComponentDefinition(definition);builder.openComponent(args,attrs.scan());builder.closeComponent();});STATEMENTS.add('static-partial',function(sexp,builder){var name=sexp[1];if(!builder.env.hasPartial(name,builder.symbolTable)){throw new Error('Compile Error: Could not find a partial named "' + name + '"');}var definition=builder.env.lookupPartial(name,builder.symbolTable);builder.putPartialDefinition(definition);builder.evaluatePartial();});STATEMENTS.add('dynamic-partial',function(sexp,builder){var name=sexp[1];builder.startLabels();builder.putValue(name);builder.test('simple');builder.enter('BEGIN','END');builder.label('BEGIN');builder.jumpUnless('END');builder.putDynamicPartialDefinition();builder.evaluatePartial();builder.label('END');builder.exit();builder.stopLabels();});STATEMENTS.add('yield',function(sexp,builder){var to=sexp[1];var params=sexp[2];var args=compileArgs(params,null,builder);builder.yield(args,to);});STATEMENTS.add('debugger',function(sexp,builder){builder.putValue(['function',function(vm){var context=vm.getSelf().value();var get=function(path){return getter(vm,builder)(path).value();};callback(context,get);}]);return sexp;});var EXPRESSIONS=new Compilers();function expr(expression,builder){if(Array.isArray(expression)){return EXPRESSIONS.compile(expression,builder);}else {return new CompiledValue(expression);}}EXPRESSIONS.add('unknown',function(sexp,builder){var path=sexp[1];if(builder.env.hasHelper(path,builder.symbolTable)){return new CompiledHelper(path,builder.env.lookupHelper(path,builder.symbolTable),CompiledArgs.empty(),builder.symbolTable);}else {return compileRef(path,builder);}});EXPRESSIONS.add('concat',function(sexp,builder){var params=sexp[1].map(function(p){return expr(p,builder);});return new CompiledConcat(params);});EXPRESSIONS.add('function',function(sexp,builder){return new CompiledFunctionExpression(sexp[1],builder.symbolTable);});EXPRESSIONS.add('helper',function(sexp,builder){var env=builder.env;var symbolTable=builder.symbolTable;var path=sexp[1];var params=sexp[2];var hash=sexp[3];if(env.hasHelper(path,symbolTable)){var args=compileArgs(params,hash,builder);return new CompiledHelper(path,env.lookupHelper(path,symbolTable),args,symbolTable);}else {throw new Error('Compile Error: ' + path.join('.') + ' is not a helper');}});EXPRESSIONS.add('get',function(sexp,builder){return compileRef(sexp[1],builder);});EXPRESSIONS.add('undefined',function(_sexp,_builder){return new CompiledValue(undefined);});EXPRESSIONS.add('arg',function(sexp,builder){var parts=sexp[1];var head=parts[0];var named=undefined,partial=undefined;if(named = builder.symbolTable.getSymbol('named',head)){var path=parts.slice(1);var inner=new CompiledSymbol(named,head);return CompiledLookup.create(inner,path);}else if(partial = builder.symbolTable.getPartialArgs()){var path=parts.slice(1);var inner=new CompiledInPartialName(partial,head);return CompiledLookup.create(inner,path);}else {throw new Error('[BUG] @' + parts.join('.') + ' is not a valid lookup path.');}});EXPRESSIONS.add('has-block',function(sexp,builder){var blockName=sexp[1];var yields=undefined,partial=undefined;if(yields = builder.symbolTable.getSymbol('yields',blockName)){var inner=new CompiledGetBlockBySymbol(yields,blockName);return new CompiledHasBlock(inner);}else if(partial = builder.symbolTable.getPartialArgs()){var inner=new CompiledInPartialGetBlock(partial,blockName);return new CompiledHasBlock(inner);}else {throw new Error('[BUG] ${blockName} is not a valid block name.');}});EXPRESSIONS.add('has-block-params',function(sexp,builder){var blockName=sexp[1];var yields=undefined,partial=undefined;if(yields = builder.symbolTable.getSymbol('yields',blockName)){var inner=new CompiledGetBlockBySymbol(yields,blockName);return new CompiledHasBlockParams(inner);}else if(partial = builder.symbolTable.getPartialArgs()){var inner=new CompiledInPartialGetBlock(partial,blockName);return new CompiledHasBlockParams(inner);}else {throw new Error('[BUG] ${blockName} is not a valid block name.');}});function compileArgs(params,hash,builder){var compiledParams=compileParams(params,builder);var compiledHash=compileHash(hash,builder);return CompiledArgs.create(compiledParams,compiledHash,EMPTY_BLOCKS);}function compileBlockArgs(params,hash,blocks,builder){var compiledParams=compileParams(params,builder);var compiledHash=compileHash(hash,builder);return CompiledArgs.create(compiledParams,compiledHash,blocks);}function compileBaselineArgs(args,builder){var params=args[0];var hash=args[1];var _default=args[2];var inverse=args[3];return CompiledArgs.create(compileParams(params,builder),compileHash(hash,builder),{default:_default,inverse:inverse});}function compileParams(params,builder){if(!params || params.length === 0)return COMPILED_EMPTY_POSITIONAL_ARGS;var compiled=params.map(function(p){return expr(p,builder);});return CompiledPositionalArgs.create(compiled);}function compileHash(hash,builder){if(!hash)return COMPILED_EMPTY_NAMED_ARGS;var keys=hash[0];var values=hash[1];if(keys.length === 0)return COMPILED_EMPTY_NAMED_ARGS;var compiled=values.map(function(p){return expr(p,builder);});return new CompiledNamedArgs(keys,compiled);}function compileRef(parts,builder){var head=parts[0];var local=undefined;if(head === null){var inner=new CompiledSelf();var path=parts.slice(1);return CompiledLookup.create(inner,path);}else if(local = builder.symbolTable.getSymbol('local',head)){var path=parts.slice(1);var inner=new CompiledSymbol(local,head);return CompiledLookup.create(inner,path);}else {var inner=new CompiledSelf();return CompiledLookup.create(inner,parts);}}var Blocks=(function(){function Blocks(){this.names = _glimmerUtil.dict();this.funcs = [];}Blocks.prototype.add = function add(name,func){this.funcs.push(func);this.names[name] = this.funcs.length - 1;};Blocks.prototype.addMissing = function addMissing(func){this.missing = func;};Blocks.prototype.compile = function compile(sexp,builder){ // assert(sexp[1].length === 1, 'paths in blocks are not supported');
var name=sexp[1][0];var index=this.names[name];if(index === undefined){_glimmerUtil.assert(!!this.missing,name + ' not found, and no catch-all block handler was registered');var func=this.missing;var handled=func(sexp,builder);_glimmerUtil.assert(!!handled,name + ' not found, and the catch-all block handler didn\'t handle it');}else {var func=this.funcs[index];func(sexp,builder);}};return Blocks;})();var BLOCKS=new Blocks();var Inlines=(function(){function Inlines(){this.names = _glimmerUtil.dict();this.funcs = [];}Inlines.prototype.add = function add(name,func){this.funcs.push(func);this.names[name] = this.funcs.length - 1;};Inlines.prototype.addMissing = function addMissing(func){this.missing = func;};Inlines.prototype.compile = function compile(sexp,builder){var value=sexp[1]; // TODO: Fix this so that expression macros can return
// things like components, so that {{component foo}}
// is the same as {{(component foo)}}
if(!Array.isArray(value))return ['expr',value];var path=undefined;var params=undefined;var hash=undefined;if(value[0] === 'helper'){path = value[1];params = value[2];hash = value[3];}else if(value[0] === 'unknown'){path = value[1];params = hash = null;}else {return ['expr',value];}if(path.length > 1 && !params && !hash){return ['expr',value];}var name=path[0];var index=this.names[name];if(index === undefined && this.missing){var func=this.missing;var returned=func(path,params,hash,builder);return returned === false?['expr',value]:returned;}else if(index !== undefined){var func=this.funcs[index];var returned=func(path,params,hash,builder);return returned === false?['expr',value]:returned;}else {return ['expr',value];}};return Inlines;})();var INLINES=new Inlines();populateBuiltins(BLOCKS,INLINES);function populateBuiltins(){var blocks=arguments.length <= 0 || arguments[0] === undefined?new Blocks():arguments[0];var inlines=arguments.length <= 1 || arguments[1] === undefined?new Inlines():arguments[1];blocks.add('if',function(sexp,builder){ //        PutArgs
//        Test(Environment)
//        Enter(BEGIN, END)
// BEGIN: Noop
//        JumpUnless(ELSE)
//        Evaluate(default)
//        Jump(END)
// ELSE:  Noop
//        Evalulate(inverse)
// END:   Noop
//        Exit
var params=sexp[2];var hash=sexp[3];var _default=sexp[4];var inverse=sexp[5];var args=compileArgs(params,hash,builder);builder.putArgs(args);builder.test('environment');builder.labelled(null,function(b){if(_default && inverse){b.jumpUnless('ELSE');b.evaluate(_default);b.jump('END');b.label('ELSE');b.evaluate(inverse);}else if(_default){b.jumpUnless('END');b.evaluate(_default);}else {throw _glimmerUtil.unreachable();}});});blocks.add('unless',function(sexp,builder){ //        PutArgs
//        Test(Environment)
//        Enter(BEGIN, END)
// BEGIN: Noop
//        JumpUnless(ELSE)
//        Evaluate(default)
//        Jump(END)
// ELSE:  Noop
//        Evalulate(inverse)
// END:   Noop
//        Exit
var params=sexp[2];var hash=sexp[3];var _default=sexp[4];var inverse=sexp[5];var args=compileArgs(params,hash,builder);builder.putArgs(args);builder.test('environment');builder.labelled(null,function(b){if(_default && inverse){b.jumpIf('ELSE');b.evaluate(_default);b.jump('END');b.label('ELSE');b.evaluate(inverse);}else if(_default){b.jumpIf('END');b.evaluate(_default);}else {throw _glimmerUtil.unreachable();}});});blocks.add('with',function(sexp,builder){ //        PutArgs
//        Test(Environment)
//        Enter(BEGIN, END)
// BEGIN: Noop
//        JumpUnless(ELSE)
//        Evaluate(default)
//        Jump(END)
// ELSE:  Noop
//        Evalulate(inverse)
// END:   Noop
//        Exit
var params=sexp[2];var hash=sexp[3];var _default=sexp[4];var inverse=sexp[5];var args=compileArgs(params,hash,builder);builder.putArgs(args);builder.test('environment');builder.labelled(null,function(b){if(_default && inverse){b.jumpUnless('ELSE');b.evaluate(_default);b.jump('END');b.label('ELSE');b.evaluate(inverse);}else if(_default){b.jumpUnless('END');b.evaluate(_default);}else {throw _glimmerUtil.unreachable();}});});blocks.add('each',function(sexp,builder){ //         Enter(BEGIN, END)
// BEGIN:  Noop
//         PutArgs
//         PutIterable
//         JumpUnless(ELSE)
//         EnterList(BEGIN2, END2)
// ITER:   Noop
//         NextIter(BREAK)
//         EnterWithKey(BEGIN2, END2)
// BEGIN2: Noop
//         PushChildScope
//         Evaluate(default)
//         PopScope
// END2:   Noop
//         Exit
//         Jump(ITER)
// BREAK:  Noop
//         ExitList
//         Jump(END)
// ELSE:   Noop
//         Evalulate(inverse)
// END:    Noop
//         Exit
var params=sexp[2];var hash=sexp[3];var _default=sexp[4];var inverse=sexp[5];var args=compileArgs(params,hash,builder);builder.labelled(args,function(b){b.putIterator();if(inverse){b.jumpUnless('ELSE');}else {b.jumpUnless('END');}b.iter(function(b){b.evaluate(_glimmerUtil.unwrap(_default));});if(inverse){b.jump('END');b.label('ELSE');b.evaluate(inverse);}});});return {blocks:blocks,inlines:inlines};}var badProtocols=['javascript:','vbscript:'];var badTags=['A','BODY','LINK','IMG','IFRAME','BASE','FORM'];var badTagsForDataURI=['EMBED'];var badAttributes=['href','src','background','action'];var badAttributesForDataURI=['src'];function has(array,item){return array.indexOf(item) !== -1;}function checkURI(tagName,attribute){return (tagName === null || has(badTags,tagName)) && has(badAttributes,attribute);}function checkDataURI(tagName,attribute){if(tagName === null)return false;return has(badTagsForDataURI,tagName) && has(badAttributesForDataURI,attribute);}function requiresSanitization(tagName,attribute){return checkURI(tagName,attribute) || checkDataURI(tagName,attribute);}function sanitizeAttributeValue(env,element,attribute,value){var tagName=null;if(value === null || value === undefined){return value;}if(isSafeString(value)){return value.toHTML();}if(!element){tagName = null;}else {tagName = element.tagName.toUpperCase();}var str=normalizeTextValue(value);if(checkURI(tagName,attribute)){var protocol=env.protocolForURL(str);if(has(badProtocols,protocol)){return 'unsafe:' + str;}}if(checkDataURI(tagName,attribute)){return 'unsafe:' + str;}return str;} /*
 * @method normalizeProperty
 * @param element {HTMLElement}
 * @param slotName {String}
 * @returns {Object} { name, type }
 */function normalizeProperty(element,slotName){var type=undefined,normalized=undefined;if(slotName in element){normalized = slotName;type = 'prop';}else {var lower=slotName.toLowerCase();if(lower in element){type = 'prop';normalized = lower;}else {type = 'attr';normalized = slotName;}}if(type === 'prop' && (normalized.toLowerCase() === 'style' || preferAttr(element.tagName,normalized))){type = 'attr';}return {normalized:normalized,type:type};} // properties that MUST be set as attributes, due to:
// * browser bug
// * strange spec outlier
var ATTR_OVERRIDES={ // phantomjs < 2.0 lets you set it as a prop but won't reflect it
// back to the attribute. button.getAttribute('type') === null
BUTTON:{type:true,form:true},INPUT:{ // Some version of IE (like IE9) actually throw an exception
// if you set input.type = 'something-unknown'
type:true,form:true, // Chrome 46.0.2464.0: 'autocorrect' in document.createElement('input') === false
// Safari 8.0.7: 'autocorrect' in document.createElement('input') === false
// Mobile Safari (iOS 8.4 simulator): 'autocorrect' in document.createElement('input') === true
autocorrect:true, // Chrome 54.0.2840.98: 'list' in document.createElement('input') === true
// Safari 9.1.3: 'list' in document.createElement('input') === false
list:true}, // element.form is actually a legitimate readOnly property, that is to be
// mutated, but must be mutated by setAttribute...
SELECT:{form:true},OPTION:{form:true},TEXTAREA:{form:true},LABEL:{form:true},FIELDSET:{form:true},LEGEND:{form:true},OBJECT:{form:true}};function preferAttr(tagName,propName){var tag=ATTR_OVERRIDES[tagName.toUpperCase()];return tag && tag[propName.toLowerCase()] || false;}var innerHTMLWrapper={colgroup:{depth:2,before:'<table><colgroup>',after:'</colgroup></table>'},table:{depth:1,before:'<table>',after:'</table>'},tbody:{depth:2,before:'<table><tbody>',after:'</tbody></table>'},tfoot:{depth:2,before:'<table><tfoot>',after:'</tfoot></table>'},thead:{depth:2,before:'<table><thead>',after:'</thead></table>'},tr:{depth:3,before:'<table><tbody><tr>',after:'</tr></tbody></table>'}}; // Patch:    innerHTML Fix
// Browsers: IE9
// Reason:   IE9 don't allow us to set innerHTML on col, colgroup, frameset,
//           html, style, table, tbody, tfoot, thead, title, tr.
// Fix:      Wrap the innerHTML we are about to set in its parents, apply the
//           wrapped innerHTML on a div, then move the unwrapped nodes into the
//           target position.
function domChanges(document,DOMChangesClass){if(!document)return DOMChangesClass;if(!shouldApplyFix(document)){return DOMChangesClass;}var div=document.createElement('div');return (function(_DOMChangesClass){babelHelpers.inherits(DOMChangesWithInnerHTMLFix,_DOMChangesClass);function DOMChangesWithInnerHTMLFix(){_DOMChangesClass.apply(this,arguments);}DOMChangesWithInnerHTMLFix.prototype.insertHTMLBefore = function insertHTMLBefore(parent,nextSibling,html){if(html === null || html === ''){return _DOMChangesClass.prototype.insertHTMLBefore.call(this,parent,nextSibling,html);}var parentTag=parent.tagName.toLowerCase();var wrapper=innerHTMLWrapper[parentTag];if(wrapper === undefined){return _DOMChangesClass.prototype.insertHTMLBefore.call(this,parent,nextSibling,html);}return fixInnerHTML(parent,wrapper,div,html,nextSibling);};return DOMChangesWithInnerHTMLFix;})(DOMChangesClass);}function treeConstruction(document,DOMTreeConstructionClass){if(!document)return DOMTreeConstructionClass;if(!shouldApplyFix(document)){return DOMTreeConstructionClass;}var div=document.createElement('div');return (function(_DOMTreeConstructionClass){babelHelpers.inherits(DOMTreeConstructionWithInnerHTMLFix,_DOMTreeConstructionClass);function DOMTreeConstructionWithInnerHTMLFix(){_DOMTreeConstructionClass.apply(this,arguments);}DOMTreeConstructionWithInnerHTMLFix.prototype.insertHTMLBefore = function insertHTMLBefore(parent,html,reference){if(html === null || html === ''){return _DOMTreeConstructionClass.prototype.insertHTMLBefore.call(this,parent,html,reference);}var parentTag=parent.tagName.toLowerCase();var wrapper=innerHTMLWrapper[parentTag];if(wrapper === undefined){return _DOMTreeConstructionClass.prototype.insertHTMLBefore.call(this,parent,html,reference);}return fixInnerHTML(parent,wrapper,div,html,reference);};return DOMTreeConstructionWithInnerHTMLFix;})(DOMTreeConstructionClass);}function fixInnerHTML(parent,wrapper,div,html,reference){var wrappedHtml=wrapper.before + html + wrapper.after;div.innerHTML = wrappedHtml;var parentNode=div;for(var i=0;i < wrapper.depth;i++) {parentNode = parentNode.childNodes[0];}var _moveNodesBefore=moveNodesBefore(parentNode,parent,reference);var first=_moveNodesBefore[0];var last=_moveNodesBefore[1];return new ConcreteBounds(parent,first,last);}function shouldApplyFix(document){var table=document.createElement('table');try{table.innerHTML = '<tbody></tbody>';}catch(e) {}finally {if(table.childNodes.length !== 0){ // It worked as expected, no fix required
return false;}}return true;}var SVG_NAMESPACE$1='http://www.w3.org/2000/svg'; // Patch:    insertAdjacentHTML on SVG Fix
// Browsers: Safari, IE, Edge, Firefox ~33-34
// Reason:   insertAdjacentHTML does not exist on SVG elements in Safari. It is
//           present but throws an exception on IE and Edge. Old versions of
//           Firefox create nodes in the incorrect namespace.
// Fix:      Since IE and Edge silently fail to create SVG nodes using
//           innerHTML, and because Firefox may create nodes in the incorrect
//           namespace using innerHTML on SVG elements, an HTML-string wrapping
//           approach is used. A pre/post SVG tag is added to the string, then
//           that whole string is added to a div. The created nodes are plucked
//           out and applied to the target location on DOM.
function domChanges$1(document,DOMChangesClass,svgNamespace){if(!document)return DOMChangesClass;if(!shouldApplyFix$1(document,svgNamespace)){return DOMChangesClass;}var div=document.createElement('div');return (function(_DOMChangesClass2){babelHelpers.inherits(DOMChangesWithSVGInnerHTMLFix,_DOMChangesClass2);function DOMChangesWithSVGInnerHTMLFix(){_DOMChangesClass2.apply(this,arguments);}DOMChangesWithSVGInnerHTMLFix.prototype.insertHTMLBefore = function insertHTMLBefore(parent,nextSibling,html){if(html === null || html === ''){return _DOMChangesClass2.prototype.insertHTMLBefore.call(this,parent,nextSibling,html);}if(parent.namespaceURI !== svgNamespace){return _DOMChangesClass2.prototype.insertHTMLBefore.call(this,parent,nextSibling,html);}return fixSVG(parent,div,html,nextSibling);};return DOMChangesWithSVGInnerHTMLFix;})(DOMChangesClass);}function treeConstruction$1(document,TreeConstructionClass,svgNamespace){if(!document)return TreeConstructionClass;if(!shouldApplyFix$1(document,svgNamespace)){return TreeConstructionClass;}var div=document.createElement('div');return (function(_TreeConstructionClass){babelHelpers.inherits(TreeConstructionWithSVGInnerHTMLFix,_TreeConstructionClass);function TreeConstructionWithSVGInnerHTMLFix(){_TreeConstructionClass.apply(this,arguments);}TreeConstructionWithSVGInnerHTMLFix.prototype.insertHTMLBefore = function insertHTMLBefore(parent,html,reference){if(html === null || html === ''){return _TreeConstructionClass.prototype.insertHTMLBefore.call(this,parent,html,reference);}if(parent.namespaceURI !== svgNamespace){return _TreeConstructionClass.prototype.insertHTMLBefore.call(this,parent,html,reference);}return fixSVG(parent,div,html,reference);};return TreeConstructionWithSVGInnerHTMLFix;})(TreeConstructionClass);}function fixSVG(parent,div,html,reference){ // IE, Edge: also do not correctly support using `innerHTML` on SVG
// namespaced elements. So here a wrapper is used.
var wrappedHtml='<svg>' + html + '</svg>';div.innerHTML = wrappedHtml;var _moveNodesBefore2=moveNodesBefore(div.firstChild,parent,reference);var first=_moveNodesBefore2[0];var last=_moveNodesBefore2[1];return new ConcreteBounds(parent,first,last);}function shouldApplyFix$1(document,svgNamespace){var svg=document.createElementNS(svgNamespace,'svg');try{svg['insertAdjacentHTML']('beforeEnd','<circle></circle>');}catch(e) {}finally { // FF: Old versions will create a node in the wrong namespace
if(svg.childNodes.length === 1 && _glimmerUtil.unwrap(svg.firstChild).namespaceURI === SVG_NAMESPACE$1){ // The test worked as expected, no fix required
return false;}return true;}} // Patch:    Adjacent text node merging fix
// Browsers: IE, Edge, Firefox w/o inspector open
// Reason:   These browsers will merge adjacent text nodes. For exmaple given
//           <div>Hello</div> with div.insertAdjacentHTML(' world') browsers
//           with proper behavior will populate div.childNodes with two items.
//           These browsers will populate it with one merged node instead.
// Fix:      Add these nodes to a wrapper element, then iterate the childNodes
//           of that wrapper and move the nodes to their target location. Note
//           that potential SVG bugs will have been handled before this fix.
//           Note that this fix must only apply to the previous text node, as
//           the base implementation of `insertHTMLBefore` already handles
//           following text nodes correctly.
function domChanges$2(document,DOMChangesClass){if(!document)return DOMChangesClass;if(!shouldApplyFix$2(document)){return DOMChangesClass;}return (function(_DOMChangesClass3){babelHelpers.inherits(DOMChangesWithTextNodeMergingFix,_DOMChangesClass3);function DOMChangesWithTextNodeMergingFix(document){_DOMChangesClass3.call(this,document);this.uselessComment = document.createComment('');}DOMChangesWithTextNodeMergingFix.prototype.insertHTMLBefore = function insertHTMLBefore(parent,nextSibling,html){if(html === null){return _DOMChangesClass3.prototype.insertHTMLBefore.call(this,parent,nextSibling,html);}var didSetUselessComment=false;var nextPrevious=nextSibling?nextSibling.previousSibling:parent.lastChild;if(nextPrevious && nextPrevious instanceof Text){didSetUselessComment = true;parent.insertBefore(this.uselessComment,nextSibling);}var bounds=_DOMChangesClass3.prototype.insertHTMLBefore.call(this,parent,nextSibling,html);if(didSetUselessComment){parent.removeChild(this.uselessComment);}return bounds;};return DOMChangesWithTextNodeMergingFix;})(DOMChangesClass);}function treeConstruction$2(document,TreeConstructionClass){if(!document)return TreeConstructionClass;if(!shouldApplyFix$2(document)){return TreeConstructionClass;}return (function(_TreeConstructionClass2){babelHelpers.inherits(TreeConstructionWithTextNodeMergingFix,_TreeConstructionClass2);function TreeConstructionWithTextNodeMergingFix(document){_TreeConstructionClass2.call(this,document);this.uselessComment = this.createComment('');}TreeConstructionWithTextNodeMergingFix.prototype.insertHTMLBefore = function insertHTMLBefore(parent,html,reference){if(html === null){return _TreeConstructionClass2.prototype.insertHTMLBefore.call(this,parent,html,reference);}var didSetUselessComment=false;var nextPrevious=reference?reference.previousSibling:parent.lastChild;if(nextPrevious && nextPrevious instanceof Text){didSetUselessComment = true;parent.insertBefore(this.uselessComment,reference);}var bounds=_TreeConstructionClass2.prototype.insertHTMLBefore.call(this,parent,html,reference);if(didSetUselessComment){parent.removeChild(this.uselessComment);}return bounds;};return TreeConstructionWithTextNodeMergingFix;})(TreeConstructionClass);}function shouldApplyFix$2(document){var mergingTextDiv=document.createElement('div');mergingTextDiv.innerHTML = 'first';mergingTextDiv.insertAdjacentHTML('beforeEnd','second');if(mergingTextDiv.childNodes.length === 2){ // It worked as expected, no fix required
return false;}return true;}var SVG_NAMESPACE='http://www.w3.org/2000/svg'; // http://www.w3.org/TR/html/syntax.html#html-integration-point
var SVG_INTEGRATION_POINTS={foreignObject:1,desc:1,title:1}; // http://www.w3.org/TR/html/syntax.html#adjust-svg-attributes
// TODO: Adjust SVG attributes
// http://www.w3.org/TR/html/syntax.html#parsing-main-inforeign
// TODO: Adjust SVG elements
// http://www.w3.org/TR/html/syntax.html#parsing-main-inforeign
var BLACKLIST_TABLE=Object.create(null);["b","big","blockquote","body","br","center","code","dd","div","dl","dt","em","embed","h1","h2","h3","h4","h5","h6","head","hr","i","img","li","listing","main","meta","nobr","ol","p","pre","ruby","s","small","span","strong","strike","sub","sup","table","tt","u","ul","var"].forEach(function(tag){return BLACKLIST_TABLE[tag] = 1;});var WHITESPACE=/[\t-\r \xA0\u1680\u180E\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/;var doc=typeof document === 'undefined'?null:document;function isWhitespace(string){return WHITESPACE.test(string);}function moveNodesBefore(source,target,nextSibling){var first=source.firstChild;var last=null;var current=first;while(current) {last = current;current = current.nextSibling;target.insertBefore(last,nextSibling);}return [first,last];}var DOM;(function(DOM){var TreeConstruction=(function(){function TreeConstruction(document){this.document = document;this.setupUselessElement();}TreeConstruction.prototype.setupUselessElement = function setupUselessElement(){this.uselessElement = this.document.createElement('div');};TreeConstruction.prototype.createElement = function createElement(tag,context){var isElementInSVGNamespace=undefined,isHTMLIntegrationPoint=undefined;if(context){isElementInSVGNamespace = context.namespaceURI === SVG_NAMESPACE || tag === 'svg';isHTMLIntegrationPoint = SVG_INTEGRATION_POINTS[context.tagName];}else {isElementInSVGNamespace = tag === 'svg';isHTMLIntegrationPoint = false;}if(isElementInSVGNamespace && !isHTMLIntegrationPoint){ // FIXME: This does not properly handle <font> with color, face, or
// size attributes, which is also disallowed by the spec. We should fix
// this.
if(BLACKLIST_TABLE[tag]){throw new Error('Cannot create a ' + tag + ' inside an SVG context');}return this.document.createElementNS(SVG_NAMESPACE,tag);}else {return this.document.createElement(tag);}};TreeConstruction.prototype.createElementNS = function createElementNS(namespace,tag){return this.document.createElementNS(namespace,tag);};TreeConstruction.prototype.setAttribute = function setAttribute(element,name,value,namespace){if(namespace){element.setAttributeNS(namespace,name,value);}else {element.setAttribute(name,value);}};TreeConstruction.prototype.createTextNode = function createTextNode(text){return this.document.createTextNode(text);};TreeConstruction.prototype.createComment = function createComment(data){return this.document.createComment(data);};TreeConstruction.prototype.insertBefore = function insertBefore(parent,node,reference){parent.insertBefore(node,reference);};TreeConstruction.prototype.insertHTMLBefore = function insertHTMLBefore(parent,html,reference){return _insertHTMLBefore(this.uselessElement,parent,reference,html);};return TreeConstruction;})();DOM.TreeConstruction = TreeConstruction;var appliedTreeContruction=TreeConstruction;appliedTreeContruction = treeConstruction$2(doc,appliedTreeContruction);appliedTreeContruction = treeConstruction(doc,appliedTreeContruction);appliedTreeContruction = treeConstruction$1(doc,appliedTreeContruction,SVG_NAMESPACE);DOM.DOMTreeConstruction = appliedTreeContruction;})(DOM || (DOM = {}));var DOMChanges=(function(){function DOMChanges(document){this.document = document;this.namespace = null;this.uselessElement = this.document.createElement('div');}DOMChanges.prototype.setAttribute = function setAttribute(element,name,value){element.setAttribute(name,value);};DOMChanges.prototype.setAttributeNS = function setAttributeNS(element,namespace,name,value){element.setAttributeNS(namespace,name,value);};DOMChanges.prototype.removeAttribute = function removeAttribute(element,name){element.removeAttribute(name);};DOMChanges.prototype.removeAttributeNS = function removeAttributeNS(element,namespace,name){element.removeAttributeNS(namespace,name);};DOMChanges.prototype.createTextNode = function createTextNode(text){return this.document.createTextNode(text);};DOMChanges.prototype.createComment = function createComment(data){return this.document.createComment(data);};DOMChanges.prototype.createElement = function createElement(tag,context){var isElementInSVGNamespace=undefined,isHTMLIntegrationPoint=undefined;if(context){isElementInSVGNamespace = context.namespaceURI === SVG_NAMESPACE || tag === 'svg';isHTMLIntegrationPoint = SVG_INTEGRATION_POINTS[context.tagName];}else {isElementInSVGNamespace = tag === 'svg';isHTMLIntegrationPoint = false;}if(isElementInSVGNamespace && !isHTMLIntegrationPoint){ // FIXME: This does not properly handle <font> with color, face, or
// size attributes, which is also disallowed by the spec. We should fix
// this.
if(BLACKLIST_TABLE[tag]){throw new Error('Cannot create a ' + tag + ' inside an SVG context');}return this.document.createElementNS(SVG_NAMESPACE,tag);}else {return this.document.createElement(tag);}};DOMChanges.prototype.insertHTMLBefore = function insertHTMLBefore(_parent,nextSibling,html){return _insertHTMLBefore(this.uselessElement,_parent,nextSibling,html);};DOMChanges.prototype.insertNodeBefore = function insertNodeBefore(parent,node,reference){if(isDocumentFragment(node)){var firstChild=node.firstChild;var lastChild=node.lastChild;this.insertBefore(parent,node,reference);return new ConcreteBounds(parent,firstChild,lastChild);}else {this.insertBefore(parent,node,reference);return new SingleNodeBounds(parent,node);}};DOMChanges.prototype.insertTextBefore = function insertTextBefore(parent,nextSibling,text){var textNode=this.createTextNode(text);this.insertBefore(parent,textNode,nextSibling);return textNode;};DOMChanges.prototype.insertBefore = function insertBefore(element,node,reference){element.insertBefore(node,reference);};DOMChanges.prototype.insertAfter = function insertAfter(element,node,reference){this.insertBefore(element,node,reference.nextSibling);};return DOMChanges;})();function _insertHTMLBefore(_useless,_parent,_nextSibling,html){ // TypeScript vendored an old version of the DOM spec where `insertAdjacentHTML`
// only exists on `HTMLElement` but not on `Element`. We actually work with the
// newer version of the DOM API here (and monkey-patch this method in `./compat`
// when we detect older browsers). This is a hack to work around this limitation.
var parent=_parent;var useless=_useless;var nextSibling=_nextSibling;var prev=nextSibling?nextSibling.previousSibling:parent.lastChild;var last=undefined;if(html === null || html === ''){return new ConcreteBounds(parent,null,null);}if(nextSibling === null){parent.insertAdjacentHTML('beforeEnd',html);last = parent.lastChild;}else if(nextSibling instanceof HTMLElement){nextSibling.insertAdjacentHTML('beforeBegin',html);last = nextSibling.previousSibling;}else { // Non-element nodes do not support insertAdjacentHTML, so add an
// element and call it on that element. Then remove the element.
//
// This also protects Edge, IE and Firefox w/o the inspector open
// from merging adjacent text nodes. See ./compat/text-node-merging-fix.ts
parent.insertBefore(useless,nextSibling);useless.insertAdjacentHTML('beforeBegin',html);last = useless.previousSibling;parent.removeChild(useless);}var first=prev?prev.nextSibling:parent.firstChild;return new ConcreteBounds(parent,first,last);}function isDocumentFragment(node){return node.nodeType === Node.DOCUMENT_FRAGMENT_NODE;}var helper=DOMChanges;helper = domChanges$2(doc,helper);helper = domChanges(doc,helper);helper = domChanges$1(doc,helper,SVG_NAMESPACE);var helper$1=helper;var DOMTreeConstruction=DOM.DOMTreeConstruction;function defaultManagers(element,attr,_isTrusting,_namespace){var tagName=element.tagName;var isSVG=element.namespaceURI === SVG_NAMESPACE;if(isSVG){return defaultAttributeManagers(tagName,attr);}var _normalizeProperty=normalizeProperty(element,attr);var type=_normalizeProperty.type;var normalized=_normalizeProperty.normalized;if(type === 'attr'){return defaultAttributeManagers(tagName,normalized);}else {return defaultPropertyManagers(tagName,normalized);}}function defaultPropertyManagers(tagName,attr){if(requiresSanitization(tagName,attr)){return new SafePropertyManager(attr);}if(isUserInputValue(tagName,attr)){return INPUT_VALUE_PROPERTY_MANAGER;}if(isOptionSelected(tagName,attr)){return OPTION_SELECTED_MANAGER;}return new PropertyManager(attr);}function defaultAttributeManagers(tagName,attr){if(requiresSanitization(tagName,attr)){return new SafeAttributeManager(attr);}return new AttributeManager(attr);}function readDOMAttr(element,attr){var isSVG=element.namespaceURI === SVG_NAMESPACE;var _normalizeProperty2=normalizeProperty(element,attr);var type=_normalizeProperty2.type;var normalized=_normalizeProperty2.normalized;if(isSVG){return element.getAttribute(normalized);}if(type === 'attr'){return element.getAttribute(normalized);}{return element[normalized];}};var AttributeManager=(function(){function AttributeManager(attr){this.attr = attr;}AttributeManager.prototype.setAttribute = function setAttribute(env,element,value,namespace){var dom=env.getAppendOperations();var normalizedValue=normalizeAttributeValue(value);if(!isAttrRemovalValue(normalizedValue)){dom.setAttribute(element,this.attr,normalizedValue,namespace);}};AttributeManager.prototype.updateAttribute = function updateAttribute(env,element,value,namespace){if(value === null || value === undefined || value === false){if(namespace){env.getDOM().removeAttributeNS(element,namespace,this.attr);}else {env.getDOM().removeAttribute(element,this.attr);}}else {this.setAttribute(env,element,value);}};return AttributeManager;})();;var PropertyManager=(function(_AttributeManager){babelHelpers.inherits(PropertyManager,_AttributeManager);function PropertyManager(){_AttributeManager.apply(this,arguments);}PropertyManager.prototype.setAttribute = function setAttribute(_env,element,value,_namespace){if(!isAttrRemovalValue(value)){element[this.attr] = value;}};PropertyManager.prototype.removeAttribute = function removeAttribute(env,element,namespace){ // TODO this sucks but to preserve properties first and to meet current
// semantics we must do this.
var attr=this.attr;if(namespace){env.getDOM().removeAttributeNS(element,namespace,attr);}else {env.getDOM().removeAttribute(element,attr);}};PropertyManager.prototype.updateAttribute = function updateAttribute(env,element,value,namespace){ // ensure the property is always updated
element[this.attr] = value;if(isAttrRemovalValue(value)){this.removeAttribute(env,element,namespace);}};return PropertyManager;})(AttributeManager);;function normalizeAttributeValue(value){if(value === false || value === undefined || value === null){return null;}if(value === true){return '';} // onclick function etc in SSR
if(typeof value === 'function'){return null;}return String(value);}function isAttrRemovalValue(value){return value === null || value === undefined;}var SafePropertyManager=(function(_PropertyManager){babelHelpers.inherits(SafePropertyManager,_PropertyManager);function SafePropertyManager(){_PropertyManager.apply(this,arguments);}SafePropertyManager.prototype.setAttribute = function setAttribute(env,element,value){_PropertyManager.prototype.setAttribute.call(this,env,element,sanitizeAttributeValue(env,element,this.attr,value));};SafePropertyManager.prototype.updateAttribute = function updateAttribute(env,element,value){_PropertyManager.prototype.updateAttribute.call(this,env,element,sanitizeAttributeValue(env,element,this.attr,value));};return SafePropertyManager;})(PropertyManager);function isUserInputValue(tagName,attribute){return (tagName === 'INPUT' || tagName === 'TEXTAREA') && attribute === 'value';}var InputValuePropertyManager=(function(_AttributeManager2){babelHelpers.inherits(InputValuePropertyManager,_AttributeManager2);function InputValuePropertyManager(){_AttributeManager2.apply(this,arguments);}InputValuePropertyManager.prototype.setAttribute = function setAttribute(_env,element,value){var input=element;input.value = normalizeTextValue(value);};InputValuePropertyManager.prototype.updateAttribute = function updateAttribute(_env,element,value){var input=element;var currentValue=input.value;var normalizedValue=normalizeTextValue(value);if(currentValue !== normalizedValue){input.value = normalizedValue;}};return InputValuePropertyManager;})(AttributeManager);var INPUT_VALUE_PROPERTY_MANAGER=new InputValuePropertyManager('value');function isOptionSelected(tagName,attribute){return tagName === 'OPTION' && attribute === 'selected';}var OptionSelectedManager=(function(_PropertyManager2){babelHelpers.inherits(OptionSelectedManager,_PropertyManager2);function OptionSelectedManager(){_PropertyManager2.apply(this,arguments);}OptionSelectedManager.prototype.setAttribute = function setAttribute(_env,element,value){if(value !== null && value !== undefined && value !== false){var option=element;option.selected = true;}};OptionSelectedManager.prototype.updateAttribute = function updateAttribute(_env,element,value){var option=element;if(value){option.selected = true;}else {option.selected = false;}};return OptionSelectedManager;})(PropertyManager);var OPTION_SELECTED_MANAGER=new OptionSelectedManager('selected');var SafeAttributeManager=(function(_AttributeManager3){babelHelpers.inherits(SafeAttributeManager,_AttributeManager3);function SafeAttributeManager(){_AttributeManager3.apply(this,arguments);}SafeAttributeManager.prototype.setAttribute = function setAttribute(env,element,value){_AttributeManager3.prototype.setAttribute.call(this,env,element,sanitizeAttributeValue(env,element,this.attr,value));};SafeAttributeManager.prototype.updateAttribute = function updateAttribute(env,element,value,_namespace){_AttributeManager3.prototype.updateAttribute.call(this,env,element,sanitizeAttributeValue(env,element,this.attr,value));};return SafeAttributeManager;})(AttributeManager);var Scope=(function(){function Scope(references){var callerScope=arguments.length <= 1 || arguments[1] === undefined?null:arguments[1];this.callerScope = null;this.slots = references;this.callerScope = callerScope;}Scope.root = function root(self){var size=arguments.length <= 1 || arguments[1] === undefined?0:arguments[1];var refs=new Array(size + 1);for(var i=0;i <= size;i++) {refs[i] = UNDEFINED_REFERENCE;}return new Scope(refs).init({self:self});};Scope.prototype.init = function init(_ref26){var self=_ref26.self;this.slots[0] = self;return this;};Scope.prototype.getSelf = function getSelf(){return this.slots[0];};Scope.prototype.getSymbol = function getSymbol(symbol){return this.slots[symbol];};Scope.prototype.getBlock = function getBlock(symbol){return this.slots[symbol];};Scope.prototype.getPartialArgs = function getPartialArgs(symbol){return this.slots[symbol];};Scope.prototype.bindSymbol = function bindSymbol(symbol,value){this.slots[symbol] = value;};Scope.prototype.bindBlock = function bindBlock(symbol,value){this.slots[symbol] = value;};Scope.prototype.bindPartialArgs = function bindPartialArgs(symbol,value){this.slots[symbol] = value;};Scope.prototype.bindCallerScope = function bindCallerScope(scope){this.callerScope = scope;};Scope.prototype.getCallerScope = function getCallerScope(){return this.callerScope;};Scope.prototype.child = function child(){return new Scope(this.slots.slice(),this.callerScope);};return Scope;})();var Transaction=(function(){function Transaction(){this.scheduledInstallManagers = [];this.scheduledInstallModifiers = [];this.scheduledUpdateModifierManagers = [];this.scheduledUpdateModifiers = [];this.createdComponents = [];this.createdManagers = [];this.updatedComponents = [];this.updatedManagers = [];this.destructors = [];}Transaction.prototype.didCreate = function didCreate(component,manager){this.createdComponents.push(component);this.createdManagers.push(manager);};Transaction.prototype.didUpdate = function didUpdate(component,manager){this.updatedComponents.push(component);this.updatedManagers.push(manager);};Transaction.prototype.scheduleInstallModifier = function scheduleInstallModifier(modifier,manager){this.scheduledInstallManagers.push(manager);this.scheduledInstallModifiers.push(modifier);};Transaction.prototype.scheduleUpdateModifier = function scheduleUpdateModifier(modifier,manager){this.scheduledUpdateModifierManagers.push(manager);this.scheduledUpdateModifiers.push(modifier);};Transaction.prototype.didDestroy = function didDestroy(d){this.destructors.push(d);};Transaction.prototype.commit = function commit(){var createdComponents=this.createdComponents;var createdManagers=this.createdManagers;for(var i=0;i < createdComponents.length;i++) {var component=createdComponents[i];var manager=createdManagers[i];manager.didCreate(component);}var updatedComponents=this.updatedComponents;var updatedManagers=this.updatedManagers;for(var i=0;i < updatedComponents.length;i++) {var component=updatedComponents[i];var manager=updatedManagers[i];manager.didUpdate(component);}var destructors=this.destructors;for(var i=0;i < destructors.length;i++) {destructors[i].destroy();}var scheduledInstallManagers=this.scheduledInstallManagers;var scheduledInstallModifiers=this.scheduledInstallModifiers;for(var i=0;i < scheduledInstallManagers.length;i++) {var manager=scheduledInstallManagers[i];var modifier=scheduledInstallModifiers[i];manager.install(modifier);}var scheduledUpdateModifierManagers=this.scheduledUpdateModifierManagers;var scheduledUpdateModifiers=this.scheduledUpdateModifiers;for(var i=0;i < scheduledUpdateModifierManagers.length;i++) {var manager=scheduledUpdateModifierManagers[i];var modifier=scheduledUpdateModifiers[i];manager.update(modifier);}};return Transaction;})();var Opcode=(function(){function Opcode(array){this.array = array;this.offset = 0;}babelHelpers.createClass(Opcode,[{key:'type',get:function(){return this.array[this.offset];}},{key:'op1',get:function(){return this.array[this.offset + 1];}},{key:'op2',get:function(){return this.array[this.offset + 2];}},{key:'op3',get:function(){return this.array[this.offset + 3];}}]);return Opcode;})();var Program=(function(){function Program(){this.opcodes = new _glimmerUtil.A(0x100000);this._offset = 0;this._opcode = new Opcode(this.opcodes);}Program.prototype.opcode = function opcode(offset){this._opcode.offset = offset;return this._opcode;};Program.prototype.set = function set(pos,opcode){var type=opcode[0];var op1=opcode[1];var op2=opcode[2];var op3=opcode[3];this.opcodes[pos] = type;this.opcodes[pos + 1] = op1;this.opcodes[pos + 2] = op2;this.opcodes[pos + 3] = op3;};Program.prototype.push = function push(opcode){var offset=this._offset;var type=opcode[0];var op1=opcode[1];var op2=opcode[2];var op3=opcode[3];this.opcodes[this._offset++] = type;this.opcodes[this._offset++] = op1;this.opcodes[this._offset++] = op2;this.opcodes[this._offset++] = op3;return offset;};babelHelpers.createClass(Program,[{key:'next',get:function(){return this._offset;}},{key:'current',get:function(){return this._offset - 4;}}]);return Program;})();var Environment=(function(){function Environment(_ref27){var appendOperations=_ref27.appendOperations;var updateOperations=_ref27.updateOperations;this._macros = null;this._transaction = null;this.constants = new Constants();this.program = new Program();this.appendOperations = appendOperations;this.updateOperations = updateOperations;}Environment.prototype.toConditionalReference = function toConditionalReference(reference){return new ConditionalReference(reference);};Environment.prototype.getAppendOperations = function getAppendOperations(){return this.appendOperations;};Environment.prototype.getDOM = function getDOM(){return this.updateOperations;};Environment.prototype.getIdentity = function getIdentity(object){return _glimmerUtil.ensureGuid(object) + '';};Environment.prototype.begin = function begin(){_glimmerUtil.assert(!this._transaction,'Cannot start a nested transaction');this._transaction = new Transaction();};Environment.prototype.didCreate = function didCreate(component,manager){this.transaction.didCreate(component,manager);};Environment.prototype.didUpdate = function didUpdate(component,manager){this.transaction.didUpdate(component,manager);};Environment.prototype.scheduleInstallModifier = function scheduleInstallModifier(modifier,manager){this.transaction.scheduleInstallModifier(modifier,manager);};Environment.prototype.scheduleUpdateModifier = function scheduleUpdateModifier(modifier,manager){this.transaction.scheduleUpdateModifier(modifier,manager);};Environment.prototype.didDestroy = function didDestroy(d){this.transaction.didDestroy(d);};Environment.prototype.commit = function commit(){this.transaction.commit();this._transaction = null;};Environment.prototype.attributeFor = function attributeFor(element,attr,isTrusting,namespace){return defaultManagers(element,attr,isTrusting,namespace === undefined?null:namespace);};Environment.prototype.macros = function macros(){var macros=this._macros;if(!macros){this._macros = macros = populateBuiltins();}return macros;};babelHelpers.createClass(Environment,[{key:'transaction',get:function(){return _glimmerUtil.expect(this._transaction,'must be in a transaction');}}]);return Environment;})();var RenderResult=(function(){function RenderResult(env,updating,bounds){this.env = env;this.updating = updating;this.bounds = bounds;}RenderResult.prototype.rerender = function rerender(){var _ref28=arguments.length <= 0 || arguments[0] === undefined?{alwaysRevalidate:false}:arguments[0];var _ref28$alwaysRevalidate=_ref28.alwaysRevalidate;var alwaysRevalidate=_ref28$alwaysRevalidate === undefined?false:_ref28$alwaysRevalidate;var env=this.env;var updating=this.updating;var vm=new UpdatingVM(env,{alwaysRevalidate:alwaysRevalidate});vm.execute(updating,this);};RenderResult.prototype.parentElement = function parentElement(){return this.bounds.parentElement();};RenderResult.prototype.firstNode = function firstNode(){return this.bounds.firstNode();};RenderResult.prototype.lastNode = function lastNode(){return this.bounds.lastNode();};RenderResult.prototype.opcodes = function opcodes(){return this.updating;};RenderResult.prototype.handleException = function handleException(){throw "this should never happen";};RenderResult.prototype.destroy = function destroy(){this.bounds.destroy();clear(this.bounds);};return RenderResult;})();var CapturedFrame=function CapturedFrame(operand,args,condition){this.operand = operand;this.args = args;this.condition = condition;};var Frame=(function(){function Frame(ops){var component=arguments.length <= 1 || arguments[1] === undefined?null:arguments[1];var manager=arguments.length <= 2 || arguments[2] === undefined?null:arguments[2];var shadow=arguments.length <= 3 || arguments[3] === undefined?null:arguments[3];this.ops = ops;this.component = component;this.manager = manager;this.shadow = shadow;this.operand = null;this.immediate = null;this.args = null;this.callerScope = null;this.blocks = null;this.condition = null;this.iterator = null;this.key = null;this.ip = ops[0];}Frame.prototype.capture = function capture(){return new CapturedFrame(this.operand,this.args,this.condition);};Frame.prototype.restore = function restore(frame){this.operand = frame['operand'];this.args = frame['args'];this.condition = frame['condition'];};return Frame;})();var FrameStack=(function(){function FrameStack(){this.frames = [];this.frame = null;}FrameStack.prototype.push = function push(ops){var component=arguments.length <= 1 || arguments[1] === undefined?null:arguments[1];var manager=arguments.length <= 2 || arguments[2] === undefined?null:arguments[2];var shadow=arguments.length <= 3 || arguments[3] === undefined?null:arguments[3];var frame=this.frame === null?this.frame = 0:++this.frame;if(this.frames.length <= frame){this.frames.push(null);}this.frames[frame] = new Frame(ops,component,manager,shadow);};FrameStack.prototype.pop = function pop(){var frames=this.frames;var frame=this.frame;frames[_glimmerUtil.expect(frame,'only pop after pushing')] = null;this.frame = frame === 0?null:frame - 1;};FrameStack.prototype.capture = function capture(){return this.currentFrame.capture();};FrameStack.prototype.restore = function restore(frame){this.currentFrame.restore(frame);};FrameStack.prototype.getOps = function getOps(){return this.currentFrame.ops;};FrameStack.prototype.getCurrent = function getCurrent(){return this.currentFrame.ip;};FrameStack.prototype.setCurrent = function setCurrent(ip){return this.currentFrame.ip = ip;};FrameStack.prototype.getOperand = function getOperand(){return _glimmerUtil.unwrap(this.currentFrame.operand);};FrameStack.prototype.setOperand = function setOperand(operand){return this.currentFrame.operand = operand;};FrameStack.prototype.getImmediate = function getImmediate(){return this.currentFrame.immediate;};FrameStack.prototype.setImmediate = function setImmediate(value){return this.currentFrame.immediate = value;}; // FIXME: These options are required in practice by the existing code, but
// figure out why.
FrameStack.prototype.getArgs = function getArgs(){return this.currentFrame.args;};FrameStack.prototype.setArgs = function setArgs(args){return this.currentFrame.args = args;};FrameStack.prototype.getCondition = function getCondition(){return _glimmerUtil.unwrap(this.currentFrame.condition);};FrameStack.prototype.setCondition = function setCondition(condition){return this.currentFrame.condition = condition;};FrameStack.prototype.getIterator = function getIterator(){return _glimmerUtil.unwrap(this.currentFrame.iterator);};FrameStack.prototype.setIterator = function setIterator(iterator){return this.currentFrame.iterator = iterator;};FrameStack.prototype.getKey = function getKey(){return this.currentFrame.key;};FrameStack.prototype.setKey = function setKey(key){return this.currentFrame.key = key;};FrameStack.prototype.getBlocks = function getBlocks(){return _glimmerUtil.unwrap(this.currentFrame.blocks);};FrameStack.prototype.setBlocks = function setBlocks(blocks){return this.currentFrame.blocks = blocks;};FrameStack.prototype.getCallerScope = function getCallerScope(){return _glimmerUtil.unwrap(this.currentFrame.callerScope);};FrameStack.prototype.setCallerScope = function setCallerScope(callerScope){return this.currentFrame.callerScope = callerScope;};FrameStack.prototype.getComponent = function getComponent(){return _glimmerUtil.unwrap(this.currentFrame.component);};FrameStack.prototype.getManager = function getManager(){return _glimmerUtil.unwrap(this.currentFrame.manager);};FrameStack.prototype.getShadow = function getShadow(){return this.currentFrame.shadow;};FrameStack.prototype.goto = function goto(ip){this.setCurrent(ip);};FrameStack.prototype.hasOpcodes = function hasOpcodes(){return this.frame !== null;};FrameStack.prototype.nextStatement = function nextStatement(env){var ip=this.frames[_glimmerUtil.unwrap(this.frame)].ip;var ops=this.getOps();if(ip <= ops[1]){var program=env.program;this.setCurrent(ip + 4);return program.opcode(ip);}else {this.pop();return null;}};babelHelpers.createClass(FrameStack,[{key:'currentFrame',get:function(){return this.frames[_glimmerUtil.unwrap(this.frame)];}}]);return FrameStack;})();var VM=(function(){function VM(env,scope,dynamicScope,elementStack){this.env = env;this.elementStack = elementStack;this.dynamicScopeStack = new _glimmerUtil.Stack();this.scopeStack = new _glimmerUtil.Stack();this.updatingOpcodeStack = new _glimmerUtil.Stack();this.cacheGroups = new _glimmerUtil.Stack();this.listBlockStack = new _glimmerUtil.Stack();this.frame = new FrameStack();this.env = env;this.constants = env.constants;this.elementStack = elementStack;this.scopeStack.push(scope);this.dynamicScopeStack.push(dynamicScope);}VM.initial = function initial(env,self,dynamicScope,elementStack,size){var scope=Scope.root(self,size);return new VM(env,scope,dynamicScope,elementStack);};VM.prototype.capture = function capture(){return {env:this.env,scope:this.scope(),dynamicScope:this.dynamicScope(),frame:this.frame.capture()};};VM.prototype.goto = function goto(ip){ // assert(this.frame.getOps().contains(op), `Illegal jump to ${op.label}`);
this.frame.goto(ip);};VM.prototype.beginCacheGroup = function beginCacheGroup(){this.cacheGroups.push(this.updating().tail());};VM.prototype.commitCacheGroup = function commitCacheGroup(){ //        JumpIfNotModified(END)
//        (head)
//        (....)
//        (tail)
//        DidModify
// END:   Noop
var END=new LabelOpcode("END");var opcodes=this.updating();var marker=this.cacheGroups.pop();var head=marker?opcodes.nextNode(marker):opcodes.head();var tail=opcodes.tail();var tag=_glimmerReference.combineSlice(new _glimmerUtil.ListSlice(head,tail));var guard=new JumpIfNotModifiedOpcode(tag,END);opcodes.insertBefore(guard,head);opcodes.append(new DidModifyOpcode(guard));opcodes.append(END);};VM.prototype.enter = function enter(sliceId){var updating=new _glimmerUtil.LinkedList();var tracker=this.stack().pushUpdatableBlock();var state=this.capture();var slice=this.constants.getSlice(sliceId);var tryOpcode=new TryOpcode(slice,state,tracker,updating);this.didEnter(tryOpcode,updating);};VM.prototype.enterWithKey = function enterWithKey(key,ops){var updating=new _glimmerUtil.LinkedList();var tracker=this.stack().pushUpdatableBlock();var state=this.capture();var tryOpcode=new TryOpcode(ops,state,tracker,updating);this.listBlock().map[key] = tryOpcode;this.didEnter(tryOpcode,updating);};VM.prototype.enterList = function enterList(ops){var updating=new _glimmerUtil.LinkedList();var tracker=this.stack().pushBlockList(updating);var state=this.capture();var artifacts=this.frame.getIterator().artifacts;var opcode=new ListBlockOpcode(ops,state,tracker,updating,artifacts);this.listBlockStack.push(opcode);this.didEnter(opcode,updating);};VM.prototype.didEnter = function didEnter(opcode,updating){this.updateWith(opcode);this.updatingOpcodeStack.push(updating);};VM.prototype.exit = function exit(){this.stack().popBlock();this.updatingOpcodeStack.pop();var parent=this.updating().tail();parent.didInitializeChildren();};VM.prototype.exitList = function exitList(){this.exit();this.listBlockStack.pop();};VM.prototype.updateWith = function updateWith(opcode){this.updating().append(opcode);};VM.prototype.listBlock = function listBlock(){return _glimmerUtil.expect(this.listBlockStack.current,'expected a list block');};VM.prototype.updating = function updating(){return _glimmerUtil.expect(this.updatingOpcodeStack.current,'expected updating opcode on the updating opcode stack');};VM.prototype.stack = function stack(){return this.elementStack;};VM.prototype.scope = function scope(){return _glimmerUtil.expect(this.scopeStack.current,'expected scope on the scope stack');};VM.prototype.dynamicScope = function dynamicScope(){return _glimmerUtil.expect(this.dynamicScopeStack.current,'expected dynamic scope on the dynamic scope stack');};VM.prototype.pushFrame = function pushFrame(block,args,callerScope){this.frame.push(block.slice);if(args)this.frame.setArgs(args);if(args && args.blocks)this.frame.setBlocks(args.blocks);if(callerScope)this.frame.setCallerScope(callerScope);};VM.prototype.pushComponentFrame = function pushComponentFrame(layout,args,callerScope,component,manager,shadow){this.frame.push(layout.slice,component,manager,shadow);if(args)this.frame.setArgs(args);if(args && args.blocks)this.frame.setBlocks(args.blocks);if(callerScope)this.frame.setCallerScope(callerScope);};VM.prototype.pushEvalFrame = function pushEvalFrame(slice){this.frame.push(slice);};VM.prototype.pushChildScope = function pushChildScope(){this.scopeStack.push(this.scope().child());};VM.prototype.pushCallerScope = function pushCallerScope(){this.scopeStack.push(_glimmerUtil.expect(this.scope().getCallerScope(),'pushCallerScope is called when a caller scope is present'));};VM.prototype.pushDynamicScope = function pushDynamicScope(){var child=this.dynamicScope().child();this.dynamicScopeStack.push(child);return child;};VM.prototype.pushRootScope = function pushRootScope(self,size){var scope=Scope.root(self,size);this.scopeStack.push(scope);return scope;};VM.prototype.popScope = function popScope(){this.scopeStack.pop();};VM.prototype.popDynamicScope = function popDynamicScope(){this.dynamicScopeStack.pop();};VM.prototype.newDestroyable = function newDestroyable(d){this.stack().newDestroyable(d);}; /// SCOPE HELPERS
VM.prototype.getSelf = function getSelf(){return this.scope().getSelf();};VM.prototype.referenceForSymbol = function referenceForSymbol(symbol){return this.scope().getSymbol(symbol);};VM.prototype.getArgs = function getArgs(){return this.frame.getArgs();}; /// EXECUTION
VM.prototype.resume = function resume(opcodes,frame){return this.execute(opcodes,function(vm){return vm.frame.restore(frame);});};VM.prototype.execute = function execute(opcodes,initialize){_glimmerUtil.LOGGER.debug("[VM] Begin program execution");var elementStack=this.elementStack;var frame=this.frame;var updatingOpcodeStack=this.updatingOpcodeStack;var env=this.env;elementStack.pushSimpleBlock();updatingOpcodeStack.push(new _glimmerUtil.LinkedList());frame.push(opcodes);if(initialize)initialize(this);var opcode=undefined;while(frame.hasOpcodes()) {if(opcode = frame.nextStatement(this.env)){_glimmerUtil.LOGGER.trace(opcode);APPEND_OPCODES.evaluate(this,opcode);}}_glimmerUtil.LOGGER.debug("[VM] Completed program execution");return new RenderResult(env,_glimmerUtil.expect(updatingOpcodeStack.pop(),'there should be a final updating opcode stack'),elementStack.popBlock());};VM.prototype.evaluateOpcode = function evaluateOpcode(opcode){APPEND_OPCODES.evaluate(this,opcode);}; // Make sure you have opcodes that push and pop a scope around this opcode
// if you need to change the scope.
VM.prototype.invokeBlock = function invokeBlock(block,args){var compiled=block.compile(this.env);this.pushFrame(compiled,args);};VM.prototype.invokePartial = function invokePartial(block){var compiled=block.compile(this.env);this.pushFrame(compiled);};VM.prototype.invokeLayout = function invokeLayout(args,layout,callerScope,component,manager,shadow){this.pushComponentFrame(layout,args,callerScope,component,manager,shadow);};VM.prototype.evaluateOperand = function evaluateOperand(expr){this.frame.setOperand(expr.evaluate(this));};VM.prototype.evaluateArgs = function evaluateArgs(args){var evaledArgs=this.frame.setArgs(args.evaluate(this));this.frame.setOperand(evaledArgs.positional.at(0));};VM.prototype.bindPositionalArgs = function bindPositionalArgs(symbols){var args=_glimmerUtil.expect(this.frame.getArgs(),'bindPositionalArgs assumes a previous setArgs');var positional=args.positional;var scope=this.scope();for(var i=0;i < symbols.length;i++) {scope.bindSymbol(symbols[i],positional.at(i));}};VM.prototype.bindNamedArgs = function bindNamedArgs(names,symbols){var args=_glimmerUtil.expect(this.frame.getArgs(),'bindNamedArgs assumes a previous setArgs');var scope=this.scope();var named=args.named;for(var i=0;i < names.length;i++) {var _name2=this.constants.getString(names[i]);scope.bindSymbol(symbols[i],named.get(_name2));}};VM.prototype.bindBlocks = function bindBlocks(names,symbols){var blocks=this.frame.getBlocks();var scope=this.scope();for(var i=0;i < names.length;i++) {var _name3=this.constants.getString(names[i]);scope.bindBlock(symbols[i],blocks && blocks[_name3] || null);}};VM.prototype.bindPartialArgs = function bindPartialArgs(symbol){var args=_glimmerUtil.expect(this.frame.getArgs(),'bindPartialArgs assumes a previous setArgs');var scope=this.scope();_glimmerUtil.assert(args,"Cannot bind named args");scope.bindPartialArgs(symbol,args);};VM.prototype.bindCallerScope = function bindCallerScope(){var callerScope=this.frame.getCallerScope();var scope=this.scope();_glimmerUtil.assert(callerScope,"Cannot bind caller scope");scope.bindCallerScope(callerScope);};VM.prototype.bindDynamicScope = function bindDynamicScope(names){var args=_glimmerUtil.expect(this.frame.getArgs(),'bindDynamicScope assumes a previous setArgs');var scope=this.dynamicScope();_glimmerUtil.assert(args,"Cannot bind dynamic scope");for(var i=0;i < names.length;i++) {var _name4=this.constants.getString(names[i]);scope.set(_name4,args.named.get(_name4));}};return VM;})();var UpdatingVM=(function(){function UpdatingVM(env,_ref29){var _ref29$alwaysRevalidate=_ref29.alwaysRevalidate;var alwaysRevalidate=_ref29$alwaysRevalidate === undefined?false:_ref29$alwaysRevalidate;this.frameStack = new _glimmerUtil.Stack();this.env = env;this.constants = env.constants;this.dom = env.getDOM();this.alwaysRevalidate = alwaysRevalidate;}UpdatingVM.prototype.execute = function execute(opcodes,handler){var frameStack=this.frameStack;this.try(opcodes,handler);while(true) {if(frameStack.isEmpty())break;var opcode=this.frame.nextStatement();if(opcode === null){this.frameStack.pop();continue;}_glimmerUtil.LOGGER.debug('[VM] OP ' + opcode.type);_glimmerUtil.LOGGER.trace(opcode);opcode.evaluate(this);}};UpdatingVM.prototype.goto = function goto(op){this.frame.goto(op);};UpdatingVM.prototype.try = function _try(ops,handler){this.frameStack.push(new UpdatingVMFrame(this,ops,handler));};UpdatingVM.prototype.throw = function _throw(){this.frame.handleException();this.frameStack.pop();};UpdatingVM.prototype.evaluateOpcode = function evaluateOpcode(opcode){opcode.evaluate(this);};babelHelpers.createClass(UpdatingVM,[{key:'frame',get:function(){return _glimmerUtil.expect(this.frameStack.current,'bug: expected a frame');}}]);return UpdatingVM;})();var BlockOpcode=(function(_UpdatingOpcode8){babelHelpers.inherits(BlockOpcode,_UpdatingOpcode8);function BlockOpcode(ops,state,bounds,children){_UpdatingOpcode8.call(this);this.ops = ops;this.type = "block";this.next = null;this.prev = null;var env=state.env;var scope=state.scope;var dynamicScope=state.dynamicScope;var frame=state.frame;this.children = children;this.env = env;this.scope = scope;this.dynamicScope = dynamicScope;this.frame = frame;this.bounds = bounds;}BlockOpcode.prototype.parentElement = function parentElement(){return this.bounds.parentElement();};BlockOpcode.prototype.firstNode = function firstNode(){return this.bounds.firstNode();};BlockOpcode.prototype.lastNode = function lastNode(){return this.bounds.lastNode();};BlockOpcode.prototype.evaluate = function evaluate(vm){vm.try(this.children,null);};BlockOpcode.prototype.destroy = function destroy(){this.bounds.destroy();};BlockOpcode.prototype.didDestroy = function didDestroy(){this.env.didDestroy(this.bounds);};BlockOpcode.prototype.toJSON = function toJSON(){var details=_glimmerUtil.dict();details["guid"] = '' + this._guid;return {guid:this._guid,type:this.type,details:details,children:this.children.toArray().map(function(op){return op.toJSON();})};};return BlockOpcode;})(UpdatingOpcode);var TryOpcode=(function(_BlockOpcode){babelHelpers.inherits(TryOpcode,_BlockOpcode);function TryOpcode(ops,state,bounds,children){_BlockOpcode.call(this,ops,state,bounds,children);this.type = "try";this.tag = this._tag = new _glimmerReference.UpdatableTag(_glimmerReference.CONSTANT_TAG);}TryOpcode.prototype.didInitializeChildren = function didInitializeChildren(){this._tag.update(_glimmerReference.combineSlice(this.children));};TryOpcode.prototype.evaluate = function evaluate(vm){vm.try(this.children,this);};TryOpcode.prototype.handleException = function handleException(){var env=this.env;var scope=this.scope;var ops=this.ops;var dynamicScope=this.dynamicScope;var frame=this.frame;var elementStack=ElementStack.resume(this.env,this.bounds,this.bounds.reset(env));var vm=new VM(env,scope,dynamicScope,elementStack);var result=vm.resume(ops,frame);this.children = result.opcodes();this.didInitializeChildren();};TryOpcode.prototype.toJSON = function toJSON(){var json=_BlockOpcode.prototype.toJSON.call(this);var details=json["details"];if(!details){details = json["details"] = {};}return _BlockOpcode.prototype.toJSON.call(this);};return TryOpcode;})(BlockOpcode);var ListRevalidationDelegate=(function(){function ListRevalidationDelegate(opcode,marker){this.opcode = opcode;this.marker = marker;this.didInsert = false;this.didDelete = false;this.map = opcode.map;this.updating = opcode['children'];}ListRevalidationDelegate.prototype.insert = function insert(key,item,memo,before){var map=this.map;var opcode=this.opcode;var updating=this.updating;var nextSibling=null;var reference=null;if(before){reference = map[before];nextSibling = reference['bounds'].firstNode();}else {nextSibling = this.marker;}var vm=opcode.vmForInsertion(nextSibling);var tryOpcode=null;vm.execute(opcode.ops,function(vm){vm.frame.setArgs(EvaluatedArgs.positional([item,memo]));vm.frame.setOperand(item);vm.frame.setCondition(new _glimmerReference.ConstReference(true));vm.frame.setKey(key);var state=vm.capture();var tracker=vm.stack().pushUpdatableBlock();tryOpcode = new TryOpcode(opcode.ops,state,tracker,vm.updating());});tryOpcode.didInitializeChildren();updating.insertBefore(tryOpcode,reference);map[key] = tryOpcode;this.didInsert = true;};ListRevalidationDelegate.prototype.retain = function retain(_key,_item,_memo){};ListRevalidationDelegate.prototype.move = function move(key,_item,_memo,before){var map=this.map;var updating=this.updating;var entry=map[key];var reference=map[before] || null;if(before){moveBounds(entry,reference.firstNode());}else {moveBounds(entry,this.marker);}updating.remove(entry);updating.insertBefore(entry,reference);};ListRevalidationDelegate.prototype.delete = function _delete(key){var map=this.map;var opcode=map[key];opcode.didDestroy();clear(opcode);this.updating.remove(opcode);delete map[key];this.didDelete = true;};ListRevalidationDelegate.prototype.done = function done(){this.opcode.didInitializeChildren(this.didInsert || this.didDelete);};return ListRevalidationDelegate;})();var ListBlockOpcode=(function(_BlockOpcode2){babelHelpers.inherits(ListBlockOpcode,_BlockOpcode2);function ListBlockOpcode(ops,state,bounds,children,artifacts){_BlockOpcode2.call(this,ops,state,bounds,children);this.type = "list-block";this.map = _glimmerUtil.dict();this.lastIterated = _glimmerReference.INITIAL;this.artifacts = artifacts;var _tag=this._tag = new _glimmerReference.UpdatableTag(_glimmerReference.CONSTANT_TAG);this.tag = _glimmerReference.combine([artifacts.tag,_tag]);}ListBlockOpcode.prototype.didInitializeChildren = function didInitializeChildren(){var listDidChange=arguments.length <= 0 || arguments[0] === undefined?true:arguments[0];this.lastIterated = this.artifacts.tag.value();if(listDidChange){this._tag.update(_glimmerReference.combineSlice(this.children));}};ListBlockOpcode.prototype.evaluate = function evaluate(vm){var artifacts=this.artifacts;var lastIterated=this.lastIterated;if(!artifacts.tag.validate(lastIterated)){var bounds=this.bounds;var dom=vm.dom;var marker=dom.createComment('');dom.insertAfter(bounds.parentElement(),marker,_glimmerUtil.expect(bounds.lastNode(),"can't insert after an empty bounds"));var target=new ListRevalidationDelegate(this,marker);var synchronizer=new _glimmerReference.IteratorSynchronizer({target:target,artifacts:artifacts});synchronizer.sync();this.parentElement().removeChild(marker);} // Run now-updated updating opcodes
_BlockOpcode2.prototype.evaluate.call(this,vm);};ListBlockOpcode.prototype.vmForInsertion = function vmForInsertion(nextSibling){var env=this.env;var scope=this.scope;var dynamicScope=this.dynamicScope;var elementStack=ElementStack.forInitialRender(this.env,this.bounds.parentElement(),nextSibling);return new VM(env,scope,dynamicScope,elementStack);};ListBlockOpcode.prototype.toJSON = function toJSON(){var json=_BlockOpcode2.prototype.toJSON.call(this);var map=this.map;var inner=Object.keys(map).map(function(key){return JSON.stringify(key) + ': ' + map[key]._guid;}).join(", ");var details=json["details"];if(!details){details = json["details"] = {};}details["map"] = '{' + inner + '}';return json;};return ListBlockOpcode;})(BlockOpcode);var UpdatingVMFrame=(function(){function UpdatingVMFrame(vm,ops,exceptionHandler){this.vm = vm;this.ops = ops;this.exceptionHandler = exceptionHandler;this.vm = vm;this.ops = ops;this.current = ops.head();}UpdatingVMFrame.prototype.goto = function goto(op){this.current = op;};UpdatingVMFrame.prototype.nextStatement = function nextStatement(){var current=this.current;var ops=this.ops;if(current)this.current = ops.nextNode(current);return current;};UpdatingVMFrame.prototype.handleException = function handleException(){if(this.exceptionHandler){this.exceptionHandler.handleException();}};return UpdatingVMFrame;})();var CompiledBlock=function CompiledBlock(slice){this.start = slice[0];this.end = slice[1];this.slice = slice;};var CompiledProgram=(function(_CompiledBlock){babelHelpers.inherits(CompiledProgram,_CompiledBlock);function CompiledProgram(slice,symbols){_CompiledBlock.call(this,slice);this.symbols = symbols;}return CompiledProgram;})(CompiledBlock);function entryPoint(meta){return new ProgramSymbolTable(meta);}function layout(meta,wireNamed,wireYields,hasPartials){var _symbols3=symbols(wireNamed,wireYields,hasPartials);var named=_symbols3.named;var yields=_symbols3.yields;var partialSymbol=_symbols3.partialSymbol;var size=_symbols3.size;return new ProgramSymbolTable(meta,named,yields,partialSymbol,size);}function block(parent,locals){var localsMap=null;var program=parent['program'];if(locals.length !== 0){(function(){var map=localsMap = _glimmerUtil.dict();locals.forEach(function(l){return map[l] = program.size++;});})();}return new BlockSymbolTable(parent,program,localsMap);}function symbols(named,yields,hasPartials){var yieldsMap=null;var namedMap=null;var size=1;if(yields.length !== 0){(function(){var map=yieldsMap = _glimmerUtil.dict();yields.forEach(function(y){return map[y] = size++;});})();}if(named.length !== 0){(function(){var map=namedMap = _glimmerUtil.dict();named.forEach(function(y){return map[y] = size++;});})();}var partialSymbol=hasPartials?size++:null;return {named:namedMap,yields:yieldsMap,partialSymbol:partialSymbol,size:size};}var ProgramSymbolTable=(function(){function ProgramSymbolTable(meta){var named=arguments.length <= 1 || arguments[1] === undefined?null:arguments[1];var yields=arguments.length <= 2 || arguments[2] === undefined?null:arguments[2];var partialArgs=arguments.length <= 3 || arguments[3] === undefined?null:arguments[3];var size=arguments.length <= 4 || arguments[4] === undefined?1:arguments[4];this.meta = meta;this.named = named;this.yields = yields;this.partialArgs = partialArgs;this.size = size;this.program = this;}ProgramSymbolTable.prototype.getMeta = function getMeta(){return this.meta;};ProgramSymbolTable.prototype.getSymbols = function getSymbols(){return {named:this.named,yields:this.yields,locals:null,partialArgs:this.partialArgs};};ProgramSymbolTable.prototype.getSymbol = function getSymbol(kind,name){if(kind === 'local')return null;return this[kind] && this[kind][name];};ProgramSymbolTable.prototype.getPartialArgs = function getPartialArgs(){return this.partialArgs || 0;};return ProgramSymbolTable;})();var BlockSymbolTable=(function(){function BlockSymbolTable(parent,program,locals){this.parent = parent;this.program = program;this.locals = locals;}BlockSymbolTable.prototype.getMeta = function getMeta(){return this.program.getMeta();};BlockSymbolTable.prototype.getSymbols = function getSymbols(){return {named:null,yields:null,locals:this.locals,partialArgs:null};};BlockSymbolTable.prototype.getSymbol = function getSymbol(kind,name){if(kind === 'local'){return this.getLocal(name);}else {return this.program.getSymbol(kind,name);}};BlockSymbolTable.prototype.getLocal = function getLocal(name){var locals=this.locals;var parent=this.parent;var symbol=locals && locals[name];if(!symbol && parent){symbol = parent.getSymbol('local',name);}return symbol;};BlockSymbolTable.prototype.getPartialArgs = function getPartialArgs(){return this.program.getPartialArgs();};return BlockSymbolTable;})();var Specialize=(function(){function Specialize(){this.names = _glimmerUtil.dict();this.funcs = [];}Specialize.prototype.add = function add(name,func){this.funcs.push(func);this.names[name] = this.funcs.length - 1;};Specialize.prototype.specialize = function specialize(sexp,table){var name=sexp[0];var index=this.names[name];if(index === undefined)return sexp;var func=this.funcs[index];_glimmerUtil.assert(!!func,'expected a specialization for ' + sexp[0]);return func(sexp,table);};return Specialize;})();var SPECIALIZE=new Specialize();var E=_glimmerWireFormat.Expressions;SPECIALIZE.add('append',function(sexp,_symbolTable){var path=sexp[1];if(Array.isArray(path) && (E.isUnknown(path) || E.isGet(path))){if(path[1].length !== 1){return ['unoptimized-append',sexp[1],sexp[2]];}}return ['optimized-append',sexp[1],sexp[2]];});SPECIALIZE.add('dynamic-attr',function(sexp,_symbolTable){return ['any-dynamic-attr',sexp[1],sexp[2],sexp[3],false];});SPECIALIZE.add('trusting-attr',function(sexp,_symbolTable){return ['any-dynamic-attr',sexp[1],sexp[2],sexp[3],true];});SPECIALIZE.add('partial',function(sexp,_table){var expression=sexp[1];if(typeof expression === 'string'){return ['static-partial',expression];}else {return ['dynamic-partial',expression];}});function compileStatement(statement,builder){var refined=SPECIALIZE.specialize(statement,builder.symbolTable);STATEMENTS.compile(refined,builder);}var Template=function Template(statements,symbolTable){this.statements = statements;this.symbolTable = symbolTable;};var Layout=(function(_Template){babelHelpers.inherits(Layout,_Template);function Layout(){_Template.apply(this,arguments);}return Layout;})(Template);var EntryPoint=(function(_Template2){babelHelpers.inherits(EntryPoint,_Template2);function EntryPoint(){_Template2.apply(this,arguments);}EntryPoint.prototype.compile = function compile(env){var table=this.symbolTable;var b=builder(env,table);for(var i=0;i < this.statements.length;i++) {var statement=this.statements[i];var refined=SPECIALIZE.specialize(statement,table);STATEMENTS.compile(refined,b);}return new CompiledProgram(b.toSlice(),this.symbolTable.size);};return EntryPoint;})(Template);var InlineBlock=(function(_Template3){babelHelpers.inherits(InlineBlock,_Template3);function InlineBlock(){_Template3.apply(this,arguments);}InlineBlock.prototype.splat = function splat(builder){var table=builder.symbolTable;var locals=table.getSymbols().locals;if(locals){builder.pushChildScope();builder.bindPositionalArgsForLocals(locals);}for(var i=0;i < this.statements.length;i++) {var statement=this.statements[i];var refined=SPECIALIZE.specialize(statement,table);STATEMENTS.compile(refined,builder);}if(locals){builder.popScope();}};InlineBlock.prototype.compile = function compile(env){var table=this.symbolTable;var b=builder(env,table);this.splat(b);return new CompiledBlock(b.toSlice());};return InlineBlock;})(Template);var PartialBlock=(function(_Template4){babelHelpers.inherits(PartialBlock,_Template4);function PartialBlock(){_Template4.apply(this,arguments);}PartialBlock.prototype.compile = function compile(env){var table=this.symbolTable;var b=builder(env,table);for(var i=0;i < this.statements.length;i++) {var statement=this.statements[i];var refined=SPECIALIZE.specialize(statement,table);STATEMENTS.compile(refined,b);}return new CompiledProgram(b.toSlice(),table.size);};return PartialBlock;})(Template);var Scanner=(function(){function Scanner(block,meta,env){this.block = block;this.meta = meta;this.env = env;}Scanner.prototype.scanEntryPoint = function scanEntryPoint(){var block=this.block;var meta=this.meta;var symbolTable=entryPoint(meta);var child=scanBlock(block,symbolTable,this.env);return new EntryPoint(child.statements,symbolTable);};Scanner.prototype.scanLayout = function scanLayout(){var block=this.block;var meta=this.meta;var named=block.named;var yields=block.yields;var hasPartials=block.hasPartials;var symbolTable=layout(meta,named,yields,hasPartials);var child=scanBlock(block,symbolTable,this.env);return new Layout(child.statements,symbolTable);};Scanner.prototype.scanPartial = function scanPartial(symbolTable){var block=this.block;var child=scanBlock(block,symbolTable,this.env);return new PartialBlock(child.statements,symbolTable);};return Scanner;})();function scanBlock(_ref30,symbolTable,env){var statements=_ref30.statements;return new RawInlineBlock(env,symbolTable,statements).scan();}var BaselineSyntax;(function(BaselineSyntax){BaselineSyntax.isScannedComponent = _glimmerWireFormat.is('scanned-component');BaselineSyntax.isPrimitiveElement = _glimmerWireFormat.is('open-primitive-element');BaselineSyntax.isOptimizedAppend = _glimmerWireFormat.is('optimized-append');BaselineSyntax.isUnoptimizedAppend = _glimmerWireFormat.is('unoptimized-append');BaselineSyntax.isAnyAttr = _glimmerWireFormat.is('any-dynamic-attr');BaselineSyntax.isStaticPartial = _glimmerWireFormat.is('static-partial');BaselineSyntax.isDynamicPartial = _glimmerWireFormat.is('dynamic-partial');BaselineSyntax.isFunctionExpression = _glimmerWireFormat.is('function');BaselineSyntax.isNestedBlock = _glimmerWireFormat.is('nested-block');BaselineSyntax.isScannedBlock = _glimmerWireFormat.is('scanned-block');BaselineSyntax.isDebugger = _glimmerWireFormat.is('debugger');var NestedBlock;(function(NestedBlock){function defaultBlock(sexp){return sexp[4];}NestedBlock.defaultBlock = defaultBlock;function inverseBlock(sexp){return sexp[5];}NestedBlock.inverseBlock = inverseBlock;function params(sexp){return sexp[2];}NestedBlock.params = params;function hash(sexp){return sexp[3];}NestedBlock.hash = hash;})(NestedBlock = BaselineSyntax.NestedBlock || (BaselineSyntax.NestedBlock = {}));})(BaselineSyntax || (exports.BaselineSyntax = BaselineSyntax = {}));var RawInlineBlock=(function(){function RawInlineBlock(env,table,statements){this.env = env;this.table = table;this.statements = statements;}RawInlineBlock.prototype.scan = function scan(){var buffer=[];for(var i=0;i < this.statements.length;i++) {var statement=this.statements[i];if(_glimmerWireFormat.Statements.isBlock(statement)){buffer.push(this.specializeBlock(statement));}else if(_glimmerWireFormat.Statements.isComponent(statement)){buffer.push.apply(buffer,this.specializeComponent(statement));}else {buffer.push(statement);}}return new InlineBlock(buffer,this.table);};RawInlineBlock.prototype.specializeBlock = function specializeBlock(block$$){var path=block$$[1];var params=block$$[2];var hash=block$$[3];var template=block$$[4];var inverse=block$$[5];return ['scanned-block',path,params,hash,this.child(template),this.child(inverse)];};RawInlineBlock.prototype.specializeComponent = function specializeComponent(sexp){var tag=sexp[1];var component=sexp[2];if(this.env.hasComponentDefinition([tag],this.table)){var child=this.child(component);var attrs=new RawInlineBlock(this.env,this.table,component.attrs);return [['scanned-component',tag,attrs,component.args,child]];}else {var buf=[];buf.push(['open-element',tag,[]]);buf.push.apply(buf,component.attrs);buf.push(['flush-element']);buf.push.apply(buf,component.statements);buf.push(['close-element']);return buf;}};RawInlineBlock.prototype.child = function child(block$$){if(!block$$)return null;var table=block(this.table,block$$.locals);return new RawInlineBlock(this.env,table,block$$.statements);};return RawInlineBlock;})();function compileLayout(compilable,env){var builder=new ComponentLayoutBuilder(env);compilable.compile(builder);return builder.compile();}var ComponentLayoutBuilder=(function(){function ComponentLayoutBuilder(env){this.env = env;}ComponentLayoutBuilder.prototype.wrapLayout = function wrapLayout(layout){this.inner = new WrappedBuilder(this.env,layout);};ComponentLayoutBuilder.prototype.fromLayout = function fromLayout(layout){this.inner = new UnwrappedBuilder(this.env,layout);};ComponentLayoutBuilder.prototype.compile = function compile(){return this.inner.compile();};babelHelpers.createClass(ComponentLayoutBuilder,[{key:'tag',get:function(){return this.inner.tag;}},{key:'attrs',get:function(){return this.inner.attrs;}}]);return ComponentLayoutBuilder;})();var WrappedBuilder=(function(){function WrappedBuilder(env,layout){this.env = env;this.layout = layout;this.tag = new ComponentTagBuilder();this.attrs = new ComponentAttrsBuilder();}WrappedBuilder.prototype.compile = function compile(){ //========DYNAMIC
//        PutValue(TagExpr)
//        Test
//        JumpUnless(BODY)
//        OpenDynamicPrimitiveElement
//        DidCreateElement
//        ...attr statements...
//        FlushElement
// BODY:  Noop
//        ...body statements...
//        PutValue(TagExpr)
//        Test
//        JumpUnless(END)
//        CloseElement
// END:   Noop
//        DidRenderLayout
//        Exit
//
//========STATIC
//        OpenPrimitiveElementOpcode
//        DidCreateElement
//        ...attr statements...
//        FlushElement
//        ...body statements...
//        CloseElement
//        DidRenderLayout
//        Exit
var env=this.env;var layout=this.layout;var symbolTable=layout.symbolTable;var b=builder(env,layout.symbolTable);b.startLabels();var dynamicTag=this.tag.getDynamic();var staticTag=undefined;if(dynamicTag){b.putValue(dynamicTag);b.test('simple');b.jumpUnless('BODY');b.openDynamicPrimitiveElement();b.didCreateElement();this.attrs['buffer'].forEach(function(statement){return compileStatement(statement,b);});b.flushElement();b.label('BODY');}else if(staticTag = this.tag.getStatic()){b.openPrimitiveElement(staticTag);b.didCreateElement();this.attrs['buffer'].forEach(function(statement){return compileStatement(statement,b);});b.flushElement();}b.preludeForLayout(layout);layout.statements.forEach(function(statement){return compileStatement(statement,b);});if(dynamicTag){b.putValue(dynamicTag);b.test('simple');b.jumpUnless('END');b.closeElement();b.label('END');}else if(staticTag){b.closeElement();}b.didRenderLayout();b.stopLabels();return new CompiledProgram(b.toSlice(),symbolTable.size);};return WrappedBuilder;})();function isOpenElement(value){var type=value[0];return type === 'open-element' || type === 'open-primitive-element';}var UnwrappedBuilder=(function(){function UnwrappedBuilder(env,layout){this.env = env;this.layout = layout;this.attrs = new ComponentAttrsBuilder();}UnwrappedBuilder.prototype.compile = function compile(){var env=this.env;var layout=this.layout;var b=builder(env,layout.symbolTable);b.startLabels();b.preludeForLayout(layout);var attrs=this.attrs['buffer'];var attrsInserted=false;for(var i=0;i < layout.statements.length;i++) {var statement=layout.statements[i];if(!attrsInserted && isOpenElement(statement)){b.openComponentElement(statement[1]);b.didCreateElement();b.shadowAttributes();attrs.forEach(function(statement){return compileStatement(statement,b);});attrsInserted = true;}else {compileStatement(statement,b);}}b.didRenderLayout();b.stopLabels();return new CompiledProgram(b.toSlice(),layout.symbolTable.size);};babelHelpers.createClass(UnwrappedBuilder,[{key:'tag',get:function(){throw new Error('BUG: Cannot call `tag` on an UnwrappedBuilder');}}]);return UnwrappedBuilder;})();var ComponentTagBuilder=(function(){function ComponentTagBuilder(){this.isDynamic = null;this.isStatic = null;this.staticTagName = null;this.dynamicTagName = null;}ComponentTagBuilder.prototype.getDynamic = function getDynamic(){if(this.isDynamic){return this.dynamicTagName;}};ComponentTagBuilder.prototype.getStatic = function getStatic(){if(this.isStatic){return this.staticTagName;}};ComponentTagBuilder.prototype.static = function _static(tagName){this.isStatic = true;this.staticTagName = tagName;};ComponentTagBuilder.prototype.dynamic = function dynamic(tagName){this.isDynamic = true;this.dynamicTagName = ['function',tagName];};return ComponentTagBuilder;})();var ComponentAttrsBuilder=(function(){function ComponentAttrsBuilder(){this.buffer = [];}ComponentAttrsBuilder.prototype.static = function _static(name,value){this.buffer.push(['static-attr',name,value,null]);};ComponentAttrsBuilder.prototype.dynamic = function dynamic(name,value){this.buffer.push(['dynamic-attr',name,['function',value],null]);};return ComponentAttrsBuilder;})();var ComponentBuilder=(function(){function ComponentBuilder(builder){this.builder = builder;this.env = builder.env;}ComponentBuilder.prototype.static = function _static(definition,args,_symbolTable,shadow){this.builder.unit(function(b){b.putComponentDefinition(definition);b.openComponent(compileBaselineArgs(args,b),shadow);b.closeComponent();});};ComponentBuilder.prototype.dynamic = function dynamic(definitionArgs,definition,args,_symbolTable,shadow){this.builder.unit(function(b){b.putArgs(compileArgs(definitionArgs[0],definitionArgs[1],b));b.putValue(['function',definition]);b.test('simple');b.enter('BEGIN','END');b.label('BEGIN');b.jumpUnless('END');b.putDynamicComponentDefinition();b.openComponent(compileBaselineArgs(args,b),shadow);b.closeComponent();b.label('END');b.exit();});};return ComponentBuilder;})();function builder(env,symbolTable){return new OpcodeBuilder(symbolTable,env);}function appendOpcode(name,op1,op2,op3){return APPEND_OPCODES.construct(name,null,op1,op2,op3);}var Labels=(function(){function Labels(){this.labels = _glimmerUtil.dict();this.jumps = [];this.ranges = [];}Labels.prototype.label = function label(name,index){this.labels[name] = index;};Labels.prototype.jump = function jump(at,Target,target){this.jumps.push({at:at,target:target,Target:Target});};Labels.prototype.range = function range(at,Range,start,end){this.ranges.push({at:at,start:start,end:end,Range:Range});};Labels.prototype.patch = function patch(constants,opcodes){for(var i=0;i < this.jumps.length;i++) {var _jumps$i=this.jumps[i];var at=_jumps$i.at;var target=_jumps$i.target;var Target=_jumps$i.Target;opcodes.set(at,APPEND_OPCODES.construct(Target,null,this.labels[target]));}for(var i=0;i < this.ranges.length;i++) {var _ranges$i=this.ranges[i];var at=_ranges$i.at;var start=_ranges$i.start;var end=_ranges$i.end;var _Range=_ranges$i.Range;var slice=constants.slice([this.labels[start],this.labels[end] - 1]);opcodes.set(at,APPEND_OPCODES.construct(_Range,null,slice));}};return Labels;})();var BasicOpcodeBuilder=(function(){function BasicOpcodeBuilder(symbolTable,env,program){this.symbolTable = symbolTable;this.env = env;this.program = program;this.labelsStack = new _glimmerUtil.Stack();this.constants = env.constants;this.start = program.next;}BasicOpcodeBuilder.prototype.opcode = function opcode(name,op1,op2,op3){this.push(appendOpcode(name,op1,op2,op3));};BasicOpcodeBuilder.prototype.push = function push(op){ // console.log(`pushing ${op && op.type}`);
if(op === null){this.program.push([0,0,0,0]);}else {this.program.push(op);}};BasicOpcodeBuilder.prototype.toSlice = function toSlice(){return [this.start,this.program.current];}; // helpers
BasicOpcodeBuilder.prototype.startLabels = function startLabels(){this.labelsStack.push(new Labels());};BasicOpcodeBuilder.prototype.stopLabels = function stopLabels(){var label=_glimmerUtil.expect(this.labelsStack.pop(),'unbalanced push and pop labels');label.patch(this.constants,this.program);}; // partials
BasicOpcodeBuilder.prototype.putPartialDefinition = function putPartialDefinition(_definition){var definition=this.constants.other(_definition);this.opcode(50, /* PutPartial */definition);};BasicOpcodeBuilder.prototype.putDynamicPartialDefinition = function putDynamicPartialDefinition(){this.opcode(49, /* PutDynamicPartial */this.constants.other(this.symbolTable));};BasicOpcodeBuilder.prototype.evaluatePartial = function evaluatePartial(){this.opcode(51, /* EvaluatePartial */this.constants.other(this.symbolTable),this.constants.other(_glimmerUtil.dict()));}; // components
BasicOpcodeBuilder.prototype.putComponentDefinition = function putComponentDefinition(definition){this.opcode(23, /* PutComponent */this.other(definition));};BasicOpcodeBuilder.prototype.putDynamicComponentDefinition = function putDynamicComponentDefinition(){this.opcode(22 /* PutDynamicComponent */);};BasicOpcodeBuilder.prototype.openComponent = function openComponent(args,shadow){this.opcode(24, /* OpenComponent */this.args(args),shadow?this.block(shadow):0);};BasicOpcodeBuilder.prototype.didCreateElement = function didCreateElement(){this.opcode(25 /* DidCreateElement */);};BasicOpcodeBuilder.prototype.shadowAttributes = function shadowAttributes(){this.opcode(26 /* ShadowAttributes */);this.opcode(21 /* CloseBlock */);};BasicOpcodeBuilder.prototype.didRenderLayout = function didRenderLayout(){this.opcode(27 /* DidRenderLayout */);};BasicOpcodeBuilder.prototype.closeComponent = function closeComponent(){this.opcode(28 /* CloseComponent */);}; // content
BasicOpcodeBuilder.prototype.dynamicContent = function dynamicContent(Opcode){this.opcode(31, /* DynamicContent */this.other(Opcode));};BasicOpcodeBuilder.prototype.cautiousAppend = function cautiousAppend(){this.dynamicContent(new OptimizedCautiousAppendOpcode());};BasicOpcodeBuilder.prototype.trustingAppend = function trustingAppend(){this.dynamicContent(new OptimizedTrustingAppendOpcode());};BasicOpcodeBuilder.prototype.guardedCautiousAppend = function guardedCautiousAppend(expression){this.dynamicContent(new GuardedCautiousAppendOpcode(this.compileExpression(expression),this.symbolTable));};BasicOpcodeBuilder.prototype.guardedTrustingAppend = function guardedTrustingAppend(expression){this.dynamicContent(new GuardedTrustingAppendOpcode(this.compileExpression(expression),this.symbolTable));}; // dom
BasicOpcodeBuilder.prototype.text = function text(_text){this.opcode(29, /* Text */this.constants.string(_text));};BasicOpcodeBuilder.prototype.openPrimitiveElement = function openPrimitiveElement(tag){this.opcode(32, /* OpenElement */this.constants.string(tag));};BasicOpcodeBuilder.prototype.openComponentElement = function openComponentElement(tag){this.opcode(35, /* OpenComponentElement */this.constants.string(tag));};BasicOpcodeBuilder.prototype.openDynamicPrimitiveElement = function openDynamicPrimitiveElement(){this.opcode(36 /* OpenDynamicElement */);};BasicOpcodeBuilder.prototype.flushElement = function flushElement(){this.opcode(37 /* FlushElement */);};BasicOpcodeBuilder.prototype.closeElement = function closeElement(){this.opcode(38 /* CloseElement */);};BasicOpcodeBuilder.prototype.staticAttr = function staticAttr(_name,_namespace,_value){var name=this.constants.string(_name);var namespace=_namespace?this.constants.string(_namespace):0;var value=this.constants.string(_value);this.opcode(40, /* StaticAttr */name,value,namespace);};BasicOpcodeBuilder.prototype.dynamicAttrNS = function dynamicAttrNS(_name,_namespace,trusting){var name=this.constants.string(_name);var namespace=this.constants.string(_namespace);this.opcode(42, /* DynamicAttrNS */name,namespace,trusting | 0);};BasicOpcodeBuilder.prototype.dynamicAttr = function dynamicAttr(_name,trusting){var name=this.constants.string(_name);this.opcode(43, /* DynamicAttr */name,trusting | 0);};BasicOpcodeBuilder.prototype.comment = function comment(_comment){var comment=this.constants.string(_comment);this.opcode(30, /* Comment */comment);};BasicOpcodeBuilder.prototype.modifier = function modifier(_name,_args){var args=this.constants.expression(this.compile(_args));var _modifierManager=this.env.lookupModifier([_name],this.symbolTable);var modifierManager=this.constants.other(_modifierManager);var name=this.constants.string(_name);this.opcode(41, /* Modifier */name,modifierManager,args);}; // lists
BasicOpcodeBuilder.prototype.putIterator = function putIterator(){this.opcode(44 /* PutIterator */);};BasicOpcodeBuilder.prototype.enterList = function enterList(start,end){this.push(null);this.labels.range(this.pos,45, /* EnterList */start,end);};BasicOpcodeBuilder.prototype.exitList = function exitList(){this.opcode(46 /* ExitList */);};BasicOpcodeBuilder.prototype.enterWithKey = function enterWithKey(start,end){this.push(null);this.labels.range(this.pos,47, /* EnterWithKey */start,end);};BasicOpcodeBuilder.prototype.nextIter = function nextIter(end){this.push(null);this.labels.jump(this.pos,48, /* NextIter */end);}; // vm
BasicOpcodeBuilder.prototype.openBlock = function openBlock(_args,_inner){var args=this.constants.expression(this.compile(_args));var inner=this.constants.other(_inner);this.opcode(20, /* OpenBlock */inner,args);};BasicOpcodeBuilder.prototype.closeBlock = function closeBlock(){this.opcode(21 /* CloseBlock */);};BasicOpcodeBuilder.prototype.pushRemoteElement = function pushRemoteElement(){this.opcode(33 /* PushRemoteElement */);};BasicOpcodeBuilder.prototype.popRemoteElement = function popRemoteElement(){this.opcode(34 /* PopRemoteElement */);};BasicOpcodeBuilder.prototype.popElement = function popElement(){this.opcode(39 /* PopElement */);};BasicOpcodeBuilder.prototype.label = function label(name){this.labels.label(name,this.nextPos);};BasicOpcodeBuilder.prototype.pushChildScope = function pushChildScope(){this.opcode(0 /* PushChildScope */);};BasicOpcodeBuilder.prototype.popScope = function popScope(){this.opcode(1 /* PopScope */);};BasicOpcodeBuilder.prototype.pushDynamicScope = function pushDynamicScope(){this.opcode(2 /* PushDynamicScope */);};BasicOpcodeBuilder.prototype.popDynamicScope = function popDynamicScope(){this.opcode(3 /* PopDynamicScope */);};BasicOpcodeBuilder.prototype.putNull = function putNull(){this.opcode(4, /* Put */this.constants.NULL_REFERENCE);};BasicOpcodeBuilder.prototype.putValue = function putValue(_expression){var expr=this.constants.expression(this.compileExpression(_expression));this.opcode(5, /* EvaluatePut */expr);};BasicOpcodeBuilder.prototype.putArgs = function putArgs(_args){var args=this.constants.expression(this.compile(_args));this.opcode(6, /* PutArgs */args);};BasicOpcodeBuilder.prototype.bindDynamicScope = function bindDynamicScope(_names){this.opcode(12, /* BindDynamicScope */this.names(_names));};BasicOpcodeBuilder.prototype.bindPositionalArgs = function bindPositionalArgs(_names,_symbols){this.opcode(7, /* BindPositionalArgs */this.names(_names),this.symbols(_symbols));};BasicOpcodeBuilder.prototype.bindNamedArgs = function bindNamedArgs(_names,_symbols){this.opcode(8, /* BindNamedArgs */this.names(_names),this.symbols(_symbols));};BasicOpcodeBuilder.prototype.bindBlocks = function bindBlocks(_names,_symbols){this.opcode(9, /* BindBlocks */this.names(_names),this.symbols(_symbols));};BasicOpcodeBuilder.prototype.enter = function enter(_enter,exit){this.push(null);this.labels.range(this.pos,13, /* Enter */_enter,exit);};BasicOpcodeBuilder.prototype.exit = function exit(){this.opcode(14 /* Exit */);};BasicOpcodeBuilder.prototype.evaluate = function evaluate(_block){var block=this.constants.block(_block);this.opcode(15, /* Evaluate */block);};BasicOpcodeBuilder.prototype.test = function test(testFunc){var _func=undefined;if(testFunc === 'const'){_func = ConstTest;}else if(testFunc === 'simple'){_func = SimpleTest;}else if(testFunc === 'environment'){_func = EnvironmentTest;}else if(typeof testFunc === 'function'){_func = testFunc;}else {throw new Error('unreachable');}var func=this.constants.function(_func);this.opcode(19, /* Test */func);};BasicOpcodeBuilder.prototype.jump = function jump(target){this.push(null);this.labels.jump(this.pos,16, /* Jump */target);};BasicOpcodeBuilder.prototype.jumpIf = function jumpIf(target){this.push(null);this.labels.jump(this.pos,17, /* JumpIf */target);};BasicOpcodeBuilder.prototype.jumpUnless = function jumpUnless(target){this.push(null);this.labels.jump(this.pos,18, /* JumpUnless */target);};BasicOpcodeBuilder.prototype.names = function names(_names){var _this=this;var names=_names.map(function(n){return _this.constants.string(n);});return this.constants.array(names);};BasicOpcodeBuilder.prototype.symbols = function symbols(_symbols2){return this.constants.array(_symbols2);};BasicOpcodeBuilder.prototype.other = function other(value){return this.constants.other(value);};BasicOpcodeBuilder.prototype.args = function args(_args2){return this.constants.expression(this.compile(_args2));};BasicOpcodeBuilder.prototype.block = function block(_block3){return this.constants.block(_block3);};babelHelpers.createClass(BasicOpcodeBuilder,[{key:'pos',get:function(){return this.program.current;}},{key:'nextPos',get:function(){return this.program.next;}},{key:'labels',get:function(){return _glimmerUtil.expect(this.labelsStack.current,'bug: not in a label stack');}}]);return BasicOpcodeBuilder;})();function isCompilableExpression(expr){return expr && typeof expr['compile'] === 'function';}var OpcodeBuilder=(function(_BasicOpcodeBuilder){babelHelpers.inherits(OpcodeBuilder,_BasicOpcodeBuilder);function OpcodeBuilder(symbolTable,env){var program=arguments.length <= 2 || arguments[2] === undefined?env.program:arguments[2];return (function(){_BasicOpcodeBuilder.call(this,symbolTable,env,program);this.component = new ComponentBuilder(this);}).apply(this,arguments);}OpcodeBuilder.prototype.compile = function compile(expr){if(isCompilableExpression(expr)){return expr.compile(this);}else {return expr;}};OpcodeBuilder.prototype.compileExpression = function compileExpression(expression){if(expression instanceof CompiledExpression){return expression;}else {return expr(expression,this);}};OpcodeBuilder.prototype.bindPositionalArgsForLocals = function bindPositionalArgsForLocals(locals){var symbols=Object.keys(locals).map(function(name){return locals[name];});this.opcode(7, /* BindPositionalArgs */this.symbols(symbols));};OpcodeBuilder.prototype.preludeForLayout = function preludeForLayout(layout){var _this2=this;var symbols=layout.symbolTable.getSymbols();if(symbols.named){(function(){var named=symbols.named;var namedNames=Object.keys(named);var namedSymbols=namedNames.map(function(n){return named[n];});_this2.opcode(8, /* BindNamedArgs */_this2.names(namedNames),_this2.symbols(namedSymbols));})();}this.opcode(11 /* BindCallerScope */);if(symbols.yields){(function(){var yields=symbols.yields;var yieldNames=Object.keys(yields);var yieldSymbols=yieldNames.map(function(n){return yields[n];});_this2.opcode(9, /* BindBlocks */_this2.names(yieldNames),_this2.symbols(yieldSymbols));})();}if(symbols.partialArgs){this.opcode(10, /* BindPartialArgs */symbols.partialArgs);}};OpcodeBuilder.prototype.yield = function _yield(args,to){var yields=undefined,partial=undefined;var inner=undefined;if(yields = this.symbolTable.getSymbol('yields',to)){inner = new CompiledGetBlockBySymbol(yields,to);}else if(partial = this.symbolTable.getPartialArgs()){inner = new CompiledInPartialGetBlock(partial,to);}else {throw new Error('[BUG] ${to} is not a valid block name.');}this.openBlock(args,inner);this.closeBlock();}; // TODO
// come back to this
OpcodeBuilder.prototype.labelled = function labelled(args,callback){if(args)this.putArgs(args);this.startLabels();this.enter('BEGIN','END');this.label('BEGIN');callback(this,'BEGIN','END');this.label('END');this.exit();this.stopLabels();}; // TODO
// come back to this
OpcodeBuilder.prototype.iter = function iter(callback){this.startLabels();this.enterList('BEGIN','END');this.label('ITER');this.nextIter('BREAK');this.enterWithKey('BEGIN','END');this.label('BEGIN');callback(this,'BEGIN','END');this.label('END');this.exit();this.jump('ITER');this.label('BREAK');this.exitList();this.stopLabels();}; // TODO
// come back to this
OpcodeBuilder.prototype.unit = function unit(callback){this.startLabels();callback(this);this.stopLabels();};return OpcodeBuilder;})(BasicOpcodeBuilder);APPEND_OPCODES.add(31, /* DynamicContent */function(vm,_ref31){var append=_ref31.op1;var opcode=vm.constants.getOther(append);opcode.evaluate(vm);});function isEmpty(value){return value === null || value === undefined || typeof value['toString'] !== 'function';}function normalizeTextValue(value){if(isEmpty(value)){return '';}return String(value);}function normalizeTrustedValue(value){if(isEmpty(value)){return '';}if(isString(value)){return value;}if(isSafeString(value)){return value.toHTML();}if(isNode(value)){return value;}return String(value);}function normalizeValue(value){if(isEmpty(value)){return '';}if(isString(value)){return value;}if(isSafeString(value) || isNode(value)){return value;}return String(value);}var AppendDynamicOpcode=(function(){function AppendDynamicOpcode(){}AppendDynamicOpcode.prototype.evaluate = function evaluate(vm){var reference=vm.frame.getOperand();var normalized=this.normalize(reference);var value=undefined,cache=undefined;if(_glimmerReference.isConst(reference)){value = normalized.value();}else {cache = new _glimmerReference.ReferenceCache(normalized);value = cache.peek();}var stack=vm.stack();var upsert=this.insert(vm.env.getAppendOperations(),stack,value);var bounds=new Fragment(upsert.bounds);stack.newBounds(bounds);if(cache /* i.e. !isConst(reference) */){vm.updateWith(this.updateWith(vm,reference,cache,bounds,upsert));}};return AppendDynamicOpcode;})();var GuardedAppendOpcode=(function(_AppendDynamicOpcode){babelHelpers.inherits(GuardedAppendOpcode,_AppendDynamicOpcode);function GuardedAppendOpcode(expression,symbolTable){_AppendDynamicOpcode.call(this);this.expression = expression;this.symbolTable = symbolTable;this.deopted = null;}GuardedAppendOpcode.prototype.evaluate = function evaluate(vm){if(this.deopted){vm.pushEvalFrame(this.deopted);}else {vm.evaluateOperand(this.expression);var value=vm.frame.getOperand().value();if(isComponentDefinition(value)){vm.pushEvalFrame(this.deopt(vm.env));}else {_AppendDynamicOpcode.prototype.evaluate.call(this,vm);}}};GuardedAppendOpcode.prototype.deopt = function deopt(env){var _this3=this; // At compile time, we determined that this append callsite might refer
// to a local variable/property lookup that resolves to a component
// definition at runtime.
//
// We could have eagerly compiled this callsite into something like this:
//
//   {{#if (is-component-definition foo)}}
//     {{component foo}}
//   {{else}}
//     {{foo}}
//   {{/if}}
//
// However, in practice, there might be a large amout of these callsites
// and most of them would resolve to a simple value lookup. Therefore, we
// tried to be optimistic and assumed that the callsite will resolve to
// appending a simple value.
//
// However, we have reached here because at runtime, the guard conditional
// have detected that this callsite is indeed referring to a component
// definition object. Since this is likely going to be true for other
// instances of the same callsite, it is now appropiate to deopt into the
// expanded version that handles both cases. The compilation would look
// like this:
//
//               PutValue(expression)
//               Test(is-component-definition)
//               Enter(BEGIN, END)
//   BEGIN:      Noop
//               JumpUnless(VALUE)
//               PutDynamicComponentDefinitionOpcode
//               OpenComponent
//               CloseComponent
//               Jump(END)
//   VALUE:      Noop
//               OptimizedAppend
//   END:        Noop
//               Exit
//
// Keep in mind that even if we *don't* reach here at initial render time,
// it is still possible (although quite rare) that the simple value we
// encounter during initial render could later change into a component
// definition object at update time. That is handled by the "lazy deopt"
// code on the update side (scroll down for the next big block of comment).
var dsl=new OpcodeBuilder(this.symbolTable,env);dsl.putValue(this.expression);dsl.test(IsComponentDefinitionReference.create);dsl.labelled(null,function(dsl,_BEGIN,END){dsl.jumpUnless('VALUE');dsl.putDynamicComponentDefinition();dsl.openComponent(CompiledArgs.empty());dsl.closeComponent();dsl.jump(END);dsl.label('VALUE');dsl.dynamicContent(new _this3.AppendOpcode());});var deopted=this.deopted = dsl.toSlice(); // From this point on, we have essentially replaced ourselves with a new set
// of opcodes. Since we will always be executing the new/deopted code, it's
// a good idea (as a pattern) to null out any unneeded fields here to avoid
// holding on to unneeded/stale objects:
// QUESTION: Shouldn't this whole object be GCed? If not, why not?
this.expression = null;return deopted;};return GuardedAppendOpcode;})(AppendDynamicOpcode);var IsComponentDefinitionReference=(function(_ConditionalReference){babelHelpers.inherits(IsComponentDefinitionReference,_ConditionalReference);function IsComponentDefinitionReference(){_ConditionalReference.apply(this,arguments);}IsComponentDefinitionReference.create = function create(inner){return new IsComponentDefinitionReference(inner);};IsComponentDefinitionReference.prototype.toBool = function toBool(value){return isComponentDefinition(value);};return IsComponentDefinitionReference;})(ConditionalReference);var UpdateOpcode=(function(_UpdatingOpcode9){babelHelpers.inherits(UpdateOpcode,_UpdatingOpcode9);function UpdateOpcode(cache,bounds,upsert){_UpdatingOpcode9.call(this);this.cache = cache;this.bounds = bounds;this.upsert = upsert;this.tag = cache.tag;}UpdateOpcode.prototype.evaluate = function evaluate(vm){var value=this.cache.revalidate();if(_glimmerReference.isModified(value)){var bounds=this.bounds;var upsert=this.upsert;var dom=vm.dom;if(!this.upsert.update(dom,value)){var cursor=new Cursor(bounds.parentElement(),clear(bounds));upsert = this.upsert = this.insert(vm.env.getAppendOperations(),cursor,value);}bounds.update(upsert.bounds);}};UpdateOpcode.prototype.toJSON = function toJSON(){var guid=this._guid;var type=this.type;var cache=this.cache;return {guid:guid,type:type,details:{lastValue:JSON.stringify(cache.peek())}};};return UpdateOpcode;})(UpdatingOpcode);var GuardedUpdateOpcode=(function(_UpdateOpcode){babelHelpers.inherits(GuardedUpdateOpcode,_UpdateOpcode);function GuardedUpdateOpcode(reference,cache,bounds,upsert,appendOpcode,state){_UpdateOpcode.call(this,cache,bounds,upsert);this.reference = reference;this.appendOpcode = appendOpcode;this.state = state;this.deopted = null;this.tag = this._tag = new _glimmerReference.UpdatableTag(this.tag);}GuardedUpdateOpcode.prototype.evaluate = function evaluate(vm){if(this.deopted){vm.evaluateOpcode(this.deopted);}else {if(isComponentDefinition(this.reference.value())){this.lazyDeopt(vm);}else {_UpdateOpcode.prototype.evaluate.call(this,vm);}}};GuardedUpdateOpcode.prototype.lazyDeopt = function lazyDeopt(vm){ // Durign initial render, we know that the reference does not contain a
// component definition, so we optimistically assumed that this append
// is just a normal append. However, at update time, we discovered that
// the reference has switched into containing a component definition, so
// we need to do a "lazy deopt", simulating what would have happened if
// we had decided to perform the deopt in the first place during initial
// render.
//
// More concretely, we would have expanded the curly into a if/else, and
// based on whether the value is a component definition or not, we would
// have entered either the dynamic component branch or the simple value
// branch.
//
// Since we rendered a simple value during initial render (and all the
// updates up until this point), we need to pretend that the result is
// produced by the "VALUE" branch of the deopted append opcode:
//
//   Try(BEGIN, END)
//     Assert(IsComponentDefinition, expected=false)
//     OptimizedUpdate
//
// In this case, because the reference has switched from being a simple
// value into a component definition, what would have happened is that
// the assert would throw, causing the Try opcode to teardown the bounds
// and rerun the original append opcode.
//
// Since the Try opcode would have nuked the updating opcodes anyway, we
// wouldn't have to worry about simulating those. All we have to do is to
// execute the Try opcode and immediately throw.
var bounds=this.bounds;var appendOpcode=this.appendOpcode;var state=this.state;var env=vm.env;var slice=appendOpcode.deopt(env);var enter=_glimmerUtil.expect(env.program.opcode(slice[0] + 8),'hardcoded deopt location');var ops=vm.constants.getSlice(enter.op1);var tracker=new UpdatableBlockTracker(bounds.parentElement());tracker.newBounds(this.bounds);var children=new _glimmerUtil.LinkedList();state.frame['condition'] = IsComponentDefinitionReference.create(_glimmerUtil.expect(state.frame['operand'],'operand should be populated'));var deopted=this.deopted = new TryOpcode(ops,state,tracker,children);this._tag.update(deopted.tag);vm.evaluateOpcode(deopted);vm.throw(); // From this point on, we have essentially replaced ourselve with a new
// opcode. Since we will always be executing the new/deopted code, it's a
// good idea (as a pattern) to null out any unneeded fields here to avoid
// holding on to unneeded/stale objects:
// QUESTION: Shouldn't this whole object be GCed? If not, why not?
this._tag = null;this.reference = null;this.cache = null;this.bounds = null;this.upsert = null;this.appendOpcode = null;this.state = null;};GuardedUpdateOpcode.prototype.toJSON = function toJSON(){var guid=this._guid;var type=this.type;var deopted=this.deopted;if(deopted){return {guid:guid,type:type,deopted:true,children:[deopted.toJSON()]};}else {return _UpdateOpcode.prototype.toJSON.call(this);}};return GuardedUpdateOpcode;})(UpdateOpcode);var OptimizedCautiousAppendOpcode=(function(_AppendDynamicOpcode2){babelHelpers.inherits(OptimizedCautiousAppendOpcode,_AppendDynamicOpcode2);function OptimizedCautiousAppendOpcode(){_AppendDynamicOpcode2.apply(this,arguments);this.type = 'optimized-cautious-append';}OptimizedCautiousAppendOpcode.prototype.normalize = function normalize(reference){return _glimmerReference.map(reference,normalizeValue);};OptimizedCautiousAppendOpcode.prototype.insert = function insert(dom,cursor,value){return cautiousInsert(dom,cursor,value);};OptimizedCautiousAppendOpcode.prototype.updateWith = function updateWith(_vm,_reference,cache,bounds,upsert){return new OptimizedCautiousUpdateOpcode(cache,bounds,upsert);};return OptimizedCautiousAppendOpcode;})(AppendDynamicOpcode);var OptimizedCautiousUpdateOpcode=(function(_UpdateOpcode2){babelHelpers.inherits(OptimizedCautiousUpdateOpcode,_UpdateOpcode2);function OptimizedCautiousUpdateOpcode(){_UpdateOpcode2.apply(this,arguments);this.type = 'optimized-cautious-update';}OptimizedCautiousUpdateOpcode.prototype.insert = function insert(dom,cursor,value){return cautiousInsert(dom,cursor,value);};return OptimizedCautiousUpdateOpcode;})(UpdateOpcode);var GuardedCautiousAppendOpcode=(function(_GuardedAppendOpcode){babelHelpers.inherits(GuardedCautiousAppendOpcode,_GuardedAppendOpcode);function GuardedCautiousAppendOpcode(){_GuardedAppendOpcode.apply(this,arguments);this.type = 'guarded-cautious-append';this.AppendOpcode = OptimizedCautiousAppendOpcode;}GuardedCautiousAppendOpcode.prototype.normalize = function normalize(reference){return _glimmerReference.map(reference,normalizeValue);};GuardedCautiousAppendOpcode.prototype.insert = function insert(dom,cursor,value){return cautiousInsert(dom,cursor,value);};GuardedCautiousAppendOpcode.prototype.updateWith = function updateWith(vm,reference,cache,bounds,upsert){return new GuardedCautiousUpdateOpcode(reference,cache,bounds,upsert,this,vm.capture());};return GuardedCautiousAppendOpcode;})(GuardedAppendOpcode);var GuardedCautiousUpdateOpcode=(function(_GuardedUpdateOpcode){babelHelpers.inherits(GuardedCautiousUpdateOpcode,_GuardedUpdateOpcode);function GuardedCautiousUpdateOpcode(){_GuardedUpdateOpcode.apply(this,arguments);this.type = 'guarded-cautious-update';}GuardedCautiousUpdateOpcode.prototype.insert = function insert(dom,cursor,value){return cautiousInsert(dom,cursor,value);};return GuardedCautiousUpdateOpcode;})(GuardedUpdateOpcode);var OptimizedTrustingAppendOpcode=(function(_AppendDynamicOpcode3){babelHelpers.inherits(OptimizedTrustingAppendOpcode,_AppendDynamicOpcode3);function OptimizedTrustingAppendOpcode(){_AppendDynamicOpcode3.apply(this,arguments);this.type = 'optimized-trusting-append';}OptimizedTrustingAppendOpcode.prototype.normalize = function normalize(reference){return _glimmerReference.map(reference,normalizeTrustedValue);};OptimizedTrustingAppendOpcode.prototype.insert = function insert(dom,cursor,value){return trustingInsert(dom,cursor,value);};OptimizedTrustingAppendOpcode.prototype.updateWith = function updateWith(_vm,_reference,cache,bounds,upsert){return new OptimizedTrustingUpdateOpcode(cache,bounds,upsert);};return OptimizedTrustingAppendOpcode;})(AppendDynamicOpcode);var OptimizedTrustingUpdateOpcode=(function(_UpdateOpcode3){babelHelpers.inherits(OptimizedTrustingUpdateOpcode,_UpdateOpcode3);function OptimizedTrustingUpdateOpcode(){_UpdateOpcode3.apply(this,arguments);this.type = 'optimized-trusting-update';}OptimizedTrustingUpdateOpcode.prototype.insert = function insert(dom,cursor,value){return trustingInsert(dom,cursor,value);};return OptimizedTrustingUpdateOpcode;})(UpdateOpcode);var GuardedTrustingAppendOpcode=(function(_GuardedAppendOpcode2){babelHelpers.inherits(GuardedTrustingAppendOpcode,_GuardedAppendOpcode2);function GuardedTrustingAppendOpcode(){_GuardedAppendOpcode2.apply(this,arguments);this.type = 'guarded-trusting-append';this.AppendOpcode = OptimizedTrustingAppendOpcode;}GuardedTrustingAppendOpcode.prototype.normalize = function normalize(reference){return _glimmerReference.map(reference,normalizeTrustedValue);};GuardedTrustingAppendOpcode.prototype.insert = function insert(dom,cursor,value){return trustingInsert(dom,cursor,value);};GuardedTrustingAppendOpcode.prototype.updateWith = function updateWith(vm,reference,cache,bounds,upsert){return new GuardedTrustingUpdateOpcode(reference,cache,bounds,upsert,this,vm.capture());};return GuardedTrustingAppendOpcode;})(GuardedAppendOpcode);var GuardedTrustingUpdateOpcode=(function(_GuardedUpdateOpcode2){babelHelpers.inherits(GuardedTrustingUpdateOpcode,_GuardedUpdateOpcode2);function GuardedTrustingUpdateOpcode(){_GuardedUpdateOpcode2.apply(this,arguments);this.type = 'trusting-update';}GuardedTrustingUpdateOpcode.prototype.insert = function insert(dom,cursor,value){return trustingInsert(dom,cursor,value);};return GuardedTrustingUpdateOpcode;})(GuardedUpdateOpcode);APPEND_OPCODES.add(49, /* PutDynamicPartial */function(vm,_ref32){var _symbolTable=_ref32.op1;var env=vm.env;var symbolTable=vm.constants.getOther(_symbolTable);function lookupPartial(name){var normalized=String(name);if(!env.hasPartial(normalized,symbolTable)){throw new Error('Could not find a partial named "' + normalized + '"');}return env.lookupPartial(normalized,symbolTable);}var reference=_glimmerReference.map(vm.frame.getOperand(),lookupPartial);var cache=_glimmerReference.isConst(reference)?undefined:new _glimmerReference.ReferenceCache(reference);var definition=cache?cache.peek():reference.value();vm.frame.setImmediate(definition);if(cache){vm.updateWith(new Assert(cache));}});APPEND_OPCODES.add(50, /* PutPartial */function(vm,_ref33){var _definition=_ref33.op1;var definition=vm.constants.getOther(_definition);vm.frame.setImmediate(definition);});APPEND_OPCODES.add(51, /* EvaluatePartial */function(vm,_ref34){var _symbolTable=_ref34.op1;var _cache=_ref34.op2;var symbolTable=vm.constants.getOther(_symbolTable);var cache=vm.constants.getOther(_cache);var _vm$frame$getImmediate=vm.frame.getImmediate();var template=_vm$frame$getImmediate.template;var block=cache[template.id];if(!block){block = template.asPartial(symbolTable);}vm.invokePartial(block);});var IterablePresenceReference=(function(){function IterablePresenceReference(artifacts){this.tag = artifacts.tag;this.artifacts = artifacts;}IterablePresenceReference.prototype.value = function value(){return !this.artifacts.isEmpty();};return IterablePresenceReference;})();APPEND_OPCODES.add(44, /* PutIterator */function(vm){var listRef=vm.frame.getOperand();var args=_glimmerUtil.expect(vm.frame.getArgs(),'PutIteratorOpcode expects a populated args register');var iterable=vm.env.iterableFor(listRef,args);var iterator=new _glimmerReference.ReferenceIterator(iterable);vm.frame.setIterator(iterator);vm.frame.setCondition(new IterablePresenceReference(iterator.artifacts));});APPEND_OPCODES.add(45, /* EnterList */function(vm,_ref35){var _slice=_ref35.op1;vm.enterList(vm.constants.getSlice(_slice));});APPEND_OPCODES.add(46, /* ExitList */function(vm){return vm.exitList();});APPEND_OPCODES.add(47, /* EnterWithKey */function(vm,_ref36){var _slice=_ref36.op2;var key=_glimmerUtil.expect(vm.frame.getKey(),'EnterWithKeyOpcode expects a populated key register');var slice=vm.constants.getSlice(_slice);vm.enterWithKey(key,slice);});var TRUE_REF=new _glimmerReference.ConstReference(true);var FALSE_REF=new _glimmerReference.ConstReference(false);APPEND_OPCODES.add(48, /* NextIter */function(vm,_ref37){var end=_ref37.op1;var item=vm.frame.getIterator().next();if(item){vm.frame.setCondition(TRUE_REF);vm.frame.setKey(item.key);vm.frame.setOperand(item.value);vm.frame.setArgs(EvaluatedArgs.positional([item.value,item.memo]));}else {vm.frame.setCondition(FALSE_REF);vm.goto(end);}});var clientId=0;function templateFactory(_ref38){var templateId=_ref38.id;var meta=_ref38.meta;var block=_ref38.block;var parsedBlock=undefined;var id=templateId || 'client-' + clientId++;var create=function(env,envMeta){var newMeta=envMeta?_glimmerUtil.assign({},envMeta,meta):meta;if(!parsedBlock){parsedBlock = JSON.parse(block);}return template(parsedBlock,id,newMeta,env);};return {id:id,meta:meta,create:create};}function template(block,id,meta,env){var scanner=new Scanner(block,meta,env);var entryPoint=undefined;var asEntryPoint=function(){if(!entryPoint)entryPoint = scanner.scanEntryPoint();return entryPoint;};var layout=undefined;var asLayout=function(){if(!layout)layout = scanner.scanLayout();return layout;};var asPartial=function(symbols){return scanner.scanPartial(symbols);};var render=function(self,appendTo,dynamicScope){var elementStack=ElementStack.forInitialRender(env,appendTo,null);var compiled=asEntryPoint().compile(env);var vm=VM.initial(env,self,dynamicScope,elementStack,compiled.symbols);return vm.execute(compiled.slice);};return {id:id,meta:meta,_block:block,asEntryPoint:asEntryPoint,asLayout:asLayout,asPartial:asPartial,render:render};}var DynamicVarReference=(function(){function DynamicVarReference(scope,nameRef){this.scope = scope;this.nameRef = nameRef;var varTag=this.varTag = new _glimmerReference.UpdatableTag(_glimmerReference.CONSTANT_TAG);this.tag = _glimmerReference.combine([nameRef.tag,varTag]);}DynamicVarReference.prototype.value = function value(){return this.getVar().value();};DynamicVarReference.prototype.get = function get(key){return this.getVar().get(key);};DynamicVarReference.prototype.getVar = function getVar(){var name=String(this.nameRef.value());var ref=this.scope.get(name);this.varTag.update(ref.tag);return ref;};return DynamicVarReference;})();function getDynamicVar(vm,args,_symbolTable){var scope=vm.dynamicScope();var nameRef=args.positional.at(0);return new DynamicVarReference(scope,nameRef);}var PartialDefinition=function PartialDefinition(name,template){this.name = name;this.template = template;};var NodeType;(function(NodeType){NodeType[NodeType["Element"] = 0] = "Element";NodeType[NodeType["Attribute"] = 1] = "Attribute";NodeType[NodeType["Text"] = 2] = "Text";NodeType[NodeType["CdataSection"] = 3] = "CdataSection";NodeType[NodeType["EntityReference"] = 4] = "EntityReference";NodeType[NodeType["Entity"] = 5] = "Entity";NodeType[NodeType["ProcessingInstruction"] = 6] = "ProcessingInstruction";NodeType[NodeType["Comment"] = 7] = "Comment";NodeType[NodeType["Document"] = 8] = "Document";NodeType[NodeType["DocumentType"] = 9] = "DocumentType";NodeType[NodeType["DocumentFragment"] = 10] = "DocumentFragment";NodeType[NodeType["Notation"] = 11] = "Notation";})(NodeType || (NodeType = {}));var Simple=Object.freeze({get NodeType(){return NodeType;}});exports.Simple = Simple;exports.templateFactory = templateFactory;exports.NULL_REFERENCE = NULL_REFERENCE;exports.UNDEFINED_REFERENCE = UNDEFINED_REFERENCE;exports.PrimitiveReference = PrimitiveReference;exports.ConditionalReference = ConditionalReference;exports.OpcodeBuilderDSL = OpcodeBuilder;exports.compileLayout = compileLayout;exports.CompiledBlock = CompiledBlock;exports.CompiledProgram = CompiledProgram;exports.IAttributeManager = AttributeManager;exports.AttributeManager = AttributeManager;exports.PropertyManager = PropertyManager;exports.INPUT_VALUE_PROPERTY_MANAGER = INPUT_VALUE_PROPERTY_MANAGER;exports.defaultManagers = defaultManagers;exports.defaultAttributeManagers = defaultAttributeManagers;exports.defaultPropertyManagers = defaultPropertyManagers;exports.readDOMAttr = readDOMAttr;exports.normalizeTextValue = normalizeTextValue;exports.CompiledExpression = CompiledExpression;exports.CompiledArgs = CompiledArgs;exports.CompiledNamedArgs = CompiledNamedArgs;exports.CompiledPositionalArgs = CompiledPositionalArgs;exports.EvaluatedArgs = EvaluatedArgs;exports.EvaluatedNamedArgs = EvaluatedNamedArgs;exports.EvaluatedPositionalArgs = EvaluatedPositionalArgs;exports.getDynamicVar = getDynamicVar;exports.BlockMacros = Blocks;exports.InlineMacros = Inlines;exports.compileArgs = compileArgs;exports.setDebuggerCallback = setDebuggerCallback;exports.resetDebuggerCallback = resetDebuggerCallback;exports.BaselineSyntax = BaselineSyntax;exports.Layout = Layout;exports.UpdatingVM = UpdatingVM;exports.RenderResult = RenderResult;exports.isSafeString = isSafeString;exports.Scope = Scope;exports.Environment = Environment;exports.PartialDefinition = PartialDefinition;exports.ComponentDefinition = ComponentDefinition;exports.isComponentDefinition = isComponentDefinition;exports.DOMChanges = helper$1;exports.IDOMChanges = DOMChanges;exports.DOMTreeConstruction = DOMTreeConstruction;exports.isWhitespace = isWhitespace;exports.insertHTMLBefore = _insertHTMLBefore;exports.ElementStack = ElementStack;exports.ConcreteBounds = ConcreteBounds;});
enifed('@glimmer/syntax', ['exports', 'handlebars', 'simple-html-tokenizer'], function (exports, _handlebars, _simpleHtmlTokenizer) {
    'use strict';

    // Statements
    function buildMustache(path, params, hash, raw, loc) {
        return {
            type: "MustacheStatement",
            path: buildPath(path),
            params: params || [],
            hash: hash || buildHash([]),
            escaped: !raw,
            loc: buildLoc(loc)
        };
    }
    function buildBlock(path, params, hash, program, inverse, loc) {
        return {
            type: "BlockStatement",
            path: buildPath(path),
            params: params ? params.map(buildPath) : [],
            hash: hash || buildHash([]),
            program: program || null,
            inverse: inverse || null,
            loc: buildLoc(loc)
        };
    }
    function buildElementModifier(path, params, hash, loc) {
        return {
            type: "ElementModifierStatement",
            path: buildPath(path),
            params: params || [],
            hash: hash || buildHash([]),
            loc: buildLoc(loc)
        };
    }
    function buildPartial(name, params, hash, indent) {
        return {
            type: "PartialStatement",
            name: name,
            params: params || [],
            hash: hash || buildHash([]),
            indent: indent
        };
    }
    function buildComment(value, loc) {
        return {
            type: "CommentStatement",
            value: value,
            loc: buildLoc(loc)
        };
    }
    function buildMustacheComment(value, loc) {
        return {
            type: "MustacheCommentStatement",
            value: value,
            loc: buildLoc(loc)
        };
    }
    function buildConcat(parts) {
        return {
            type: "ConcatStatement",
            parts: parts || []
        };
    }
    // Nodes
    function buildElement(tag, attributes, modifiers, children, comments, loc) {
        // this is used for backwards compat prior to `comments` being added to the AST
        if (!Array.isArray(comments)) {
            loc = comments;
            comments = [];
        }
        return {
            type: "ElementNode",
            tag: tag || "",
            attributes: attributes || [],
            blockParams: [],
            modifiers: modifiers || [],
            comments: comments || [],
            children: children || [],
            loc: buildLoc(loc)
        };
    }
    function buildAttr(name, value, loc) {
        return {
            type: "AttrNode",
            name: name,
            value: value,
            loc: buildLoc(loc)
        };
    }
    function buildText(chars, loc) {
        return {
            type: "TextNode",
            chars: chars || "",
            loc: buildLoc(loc)
        };
    }
    // Expressions
    function buildSexpr(path, params, hash, loc) {
        return {
            type: "SubExpression",
            path: buildPath(path),
            params: params || [],
            hash: hash || buildHash([]),
            loc: buildLoc(loc)
        };
    }
    function buildPath(original, loc) {
        if (typeof original !== 'string') return original;
        var parts = original.split('.');
        if (parts[0] === 'this') {
            parts[0] = null;
        }
        return {
            type: "PathExpression",
            original: original,
            parts: parts,
            data: false,
            loc: buildLoc(loc)
        };
    }
    function buildString(value) {
        return {
            type: "StringLiteral",
            value: value,
            original: value
        };
    }
    function buildBoolean(value) {
        return {
            type: "BooleanLiteral",
            value: value,
            original: value
        };
    }
    function buildNumber(value) {
        return {
            type: "NumberLiteral",
            value: value,
            original: value
        };
    }
    function buildNull() {
        return {
            type: "NullLiteral",
            value: null,
            original: null
        };
    }
    function buildUndefined() {
        return {
            type: "UndefinedLiteral",
            value: undefined,
            original: undefined
        };
    }
    // Miscellaneous
    function buildHash(pairs) {
        return {
            type: "Hash",
            pairs: pairs || []
        };
    }
    function buildPair(key, value) {
        return {
            type: "HashPair",
            key: key,
            value: value
        };
    }
    function buildProgram(body, blockParams, loc) {
        return {
            type: "Program",
            body: body || [],
            blockParams: blockParams || [],
            loc: buildLoc(loc)
        };
    }
    function buildSource(source) {
        return source || null;
    }
    function buildPosition(line, column) {
        return {
            line: typeof line === 'number' ? line : null,
            column: typeof column === 'number' ? column : null
        };
    }
    function buildLoc() {
        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
        }

        if (args.length === 1) {
            var loc = args[0];
            if (typeof loc === 'object') {
                return {
                    source: buildSource(loc.source),
                    start: buildPosition(loc.start.line, loc.start.column),
                    end: buildPosition(loc.end.line, loc.end.column)
                };
            } else {
                return null;
            }
        } else {
            var startLine = args[0];
            var startColumn = args[1];
            var endLine = args[2];
            var endColumn = args[3];
            var source = args[4];

            return {
                source: buildSource(source),
                start: buildPosition(startLine, startColumn),
                end: buildPosition(endLine, endColumn)
            };
        }
    }
    var b = {
        mustache: buildMustache,
        block: buildBlock,
        partial: buildPartial,
        comment: buildComment,
        mustacheComment: buildMustacheComment,
        element: buildElement,
        elementModifier: buildElementModifier,
        attr: buildAttr,
        text: buildText,
        sexpr: buildSexpr,
        path: buildPath,
        string: buildString,
        boolean: buildBoolean,
        number: buildNumber,
        undefined: buildUndefined,
        null: buildNull,
        concat: buildConcat,
        hash: buildHash,
        pair: buildPair,
        program: buildProgram,
        loc: buildLoc,
        pos: buildPosition
    };

    function build(ast) {
        if (!ast) {
            return '';
        }
        var output = [];
        switch (ast.type) {
            case 'Program':
                {
                    var chainBlock = ast.chained && ast.body[0];
                    if (chainBlock) {
                        chainBlock.chained = true;
                    }
                    var body = buildEach(ast.body).join('');
                    output.push(body);
                }
                break;
            case 'ElementNode':
                output.push('<', ast.tag);
                if (ast.attributes.length) {
                    output.push(' ', buildEach(ast.attributes).join(' '));
                }
                if (ast.modifiers.length) {
                    output.push(' ', buildEach(ast.modifiers).join(' '));
                }
                if (ast.comments.length) {
                    output.push(' ', buildEach(ast.comments).join(' '));
                }
                output.push('>');
                output.push.apply(output, buildEach(ast.children));
                output.push('</', ast.tag, '>');
                break;
            case 'AttrNode':
                output.push(ast.name, '=');
                var value = build(ast.value);
                if (ast.value.type === 'TextNode') {
                    output.push('"', value, '"');
                } else {
                    output.push(value);
                }
                break;
            case 'ConcatStatement':
                output.push('"');
                ast.parts.forEach(function (node) {
                    if (node.type === 'StringLiteral') {
                        output.push(node.original);
                    } else {
                        output.push(build(node));
                    }
                });
                output.push('"');
                break;
            case 'TextNode':
                output.push(ast.chars);
                break;
            case 'MustacheStatement':
                {
                    output.push(compactJoin(['{{', pathParams(ast), '}}']));
                }
                break;
            case 'MustacheCommentStatement':
                {
                    output.push(compactJoin(['{{!--', ast.value, '--}}']));
                }
                break;
            case 'ElementModifierStatement':
                {
                    output.push(compactJoin(['{{', pathParams(ast), '}}']));
                }
                break;
            case 'PathExpression':
                output.push(ast.original);
                break;
            case 'SubExpression':
                {
                    output.push('(', pathParams(ast), ')');
                }
                break;
            case 'BooleanLiteral':
                output.push(ast.value ? 'true' : false);
                break;
            case 'BlockStatement':
                {
                    var lines = [];
                    if (ast.chained) {
                        lines.push(['{{else ', pathParams(ast), '}}'].join(''));
                    } else {
                        lines.push(openBlock(ast));
                    }
                    lines.push(build(ast.program));
                    if (ast.inverse) {
                        if (!ast.inverse.chained) {
                            lines.push('{{else}}');
                        }
                        lines.push(build(ast.inverse));
                    }
                    if (!ast.chained) {
                        lines.push(closeBlock(ast));
                    }
                    output.push(lines.join(''));
                }
                break;
            case 'PartialStatement':
                {
                    output.push(compactJoin(['{{>', pathParams(ast), '}}']));
                }
                break;
            case 'CommentStatement':
                {
                    output.push(compactJoin(['<!--', ast.value, '-->']));
                }
                break;
            case 'StringLiteral':
                {
                    output.push('"' + ast.value + '"');
                }
                break;
            case 'NumberLiteral':
                {
                    output.push(ast.value);
                }
                break;
            case 'UndefinedLiteral':
                {
                    output.push('undefined');
                }
                break;
            case 'NullLiteral':
                {
                    output.push('null');
                }
                break;
            case 'Hash':
                {
                    output.push(ast.pairs.map(function (pair) {
                        return build(pair);
                    }).join(' '));
                }
                break;
            case 'HashPair':
                {
                    output.push(ast.key + '=' + build(ast.value));
                }
                break;
        }
        return output.join('');
    }
    function compact(array) {
        var newArray = [];
        array.forEach(function (a) {
            if (typeof a !== 'undefined' && a !== null && a !== '') {
                newArray.push(a);
            }
        });
        return newArray;
    }
    function buildEach(asts) {
        var output = [];
        asts.forEach(function (node) {
            output.push(build(node));
        });
        return output;
    }
    function pathParams(ast) {
        var name = build(ast.name);
        var path = build(ast.path);
        var params = buildEach(ast.params).join(' ');
        var hash = build(ast.hash);
        return compactJoin([name, path, params, hash], ' ');
    }
    function compactJoin(array, delimiter) {
        return compact(array).join(delimiter || '');
    }
    function blockParams(block) {
        var params = block.program.blockParams;
        if (params.length) {
            return ' as |' + params.join(' ') + '|';
        }
    }
    function openBlock(block) {
        return ['{{#', pathParams(block), blockParams(block), '}}'].join('');
    }
    function closeBlock(block) {
        return ['{{/', build(block.path), '}}'].join('');
    }

    var visitorKeys = {
        Program: ['body'],
        MustacheStatement: ['path', 'params', 'hash'],
        BlockStatement: ['path', 'params', 'hash', 'program', 'inverse'],
        ElementModifierStatement: ['path', 'params', 'hash'],
        PartialStatement: ['name', 'params', 'hash'],
        CommentStatement: [],
        MustacheCommentStatement: [],
        ElementNode: ['attributes', 'modifiers', 'children', 'comments'],
        AttrNode: ['value'],
        TextNode: [],
        ConcatStatement: ['parts'],
        SubExpression: ['path', 'params', 'hash'],
        PathExpression: [],
        StringLiteral: [],
        BooleanLiteral: [],
        NumberLiteral: [],
        NullLiteral: [],
        UndefinedLiteral: [],
        Hash: ['pairs'],
        HashPair: ['value']
    };

    function TraversalError(message, node, parent, key) {
        this.name = "TraversalError";
        this.message = message;
        this.node = node;
        this.parent = parent;
        this.key = key;
    }
    TraversalError.prototype = Object.create(Error.prototype);
    TraversalError.prototype.constructor = TraversalError;
    function cannotRemoveNode(node, parent, key) {
        return new TraversalError("Cannot remove a node unless it is part of an array", node, parent, key);
    }
    function cannotReplaceNode(node, parent, key) {
        return new TraversalError("Cannot replace a node with multiple nodes unless it is part of an array", node, parent, key);
    }
    function cannotReplaceOrRemoveInKeyHandlerYet(node, key) {
        return new TraversalError("Replacing and removing in key handlers is not yet supported.", node, null, key);
    }

    function visitNode(visitor, node) {
        var handler = visitor[node.type] || visitor.All;
        var result = undefined;
        if (handler && handler.enter) {
            result = handler.enter.call(null, node);
        }
        if (result !== undefined && result !== null) {
            if (JSON.stringify(node) === JSON.stringify(result)) {
                result = undefined;
            } else if (Array.isArray(result)) {
                return visitArray(visitor, result) || result;
            } else {
                return visitNode(visitor, result) || result;
            }
        }
        if (result === undefined) {
            var keys = visitorKeys[node.type];
            for (var i = 0; i < keys.length; i++) {
                visitKey(visitor, handler, node, keys[i]);
            }
            if (handler && handler.exit) {
                result = handler.exit.call(null, node);
            }
        }
        return result;
    }
    function visitKey(visitor, handler, node, key) {
        var value = node[key];
        if (!value) {
            return;
        }
        var keyHandler = handler && (handler.keys[key] || handler.keys.All);
        var result = undefined;
        if (keyHandler && keyHandler.enter) {
            result = keyHandler.enter.call(null, node, key);
            if (result !== undefined) {
                throw cannotReplaceOrRemoveInKeyHandlerYet(node, key);
            }
        }
        if (Array.isArray(value)) {
            visitArray(visitor, value);
        } else {
            var _result = visitNode(visitor, value);
            if (_result !== undefined) {
                assignKey(node, key, _result);
            }
        }
        if (keyHandler && keyHandler.exit) {
            result = keyHandler.exit.call(null, node, key);
            if (result !== undefined) {
                throw cannotReplaceOrRemoveInKeyHandlerYet(node, key);
            }
        }
    }
    function visitArray(visitor, array) {
        for (var i = 0; i < array.length; i++) {
            var result = visitNode(visitor, array[i]);
            if (result !== undefined) {
                i += spliceArray(array, i, result) - 1;
            }
        }
    }
    function assignKey(node, key, result) {
        if (result === null) {
            throw cannotRemoveNode(node[key], node, key);
        } else if (Array.isArray(result)) {
            if (result.length === 1) {
                node[key] = result[0];
            } else {
                if (result.length === 0) {
                    throw cannotRemoveNode(node[key], node, key);
                } else {
                    throw cannotReplaceNode(node[key], node, key);
                }
            }
        } else {
            node[key] = result;
        }
    }
    function spliceArray(array, index, result) {
        if (result === null) {
            array.splice(index, 1);
            return 0;
        } else if (Array.isArray(result)) {
            array.splice.apply(array, [index, 1].concat(result));
            return result.length;
        } else {
            array.splice(index, 1, result);
            return 1;
        }
    }
    function traverse(node, visitor) {
        visitNode(normalizeVisitor(visitor), node);
    }
    function normalizeVisitor(visitor) {
        var normalizedVisitor = {};
        for (var type in visitor) {
            var handler = visitor[type] || visitor.All;
            var normalizedKeys = {};
            if (typeof handler === 'object') {
                var keys = handler.keys;
                if (keys) {
                    for (var key in keys) {
                        var keyHandler = keys[key];
                        if (typeof keyHandler === 'object') {
                            normalizedKeys[key] = {
                                enter: typeof keyHandler.enter === 'function' ? keyHandler.enter : null,
                                exit: typeof keyHandler.exit === 'function' ? keyHandler.exit : null
                            };
                        } else if (typeof keyHandler === 'function') {
                            normalizedKeys[key] = {
                                enter: keyHandler,
                                exit: null
                            };
                        }
                    }
                }
                normalizedVisitor[type] = {
                    enter: typeof handler.enter === 'function' ? handler.enter : null,
                    exit: typeof handler.exit === 'function' ? handler.exit : null,
                    keys: normalizedKeys
                };
            } else if (typeof handler === 'function') {
                normalizedVisitor[type] = {
                    enter: handler,
                    exit: null,
                    keys: normalizedKeys
                };
            }
        }
        return normalizedVisitor;
    }

    function Walker() {
        var order = arguments.length <= 0 || arguments[0] === undefined ? undefined : arguments[0];

        this.order = order;
        this.stack = [];
    }
    Walker.prototype.visit = function (node, callback) {
        if (!node) {
            return;
        }
        this.stack.push(node);
        if (this.order === 'post') {
            this.children(node, callback);
            callback(node, this);
        } else {
            callback(node, this);
            this.children(node, callback);
        }
        this.stack.pop();
    };
    var visitors = {
        Program: function (walker, node, callback) {
            for (var i = 0; i < node.body.length; i++) {
                walker.visit(node.body[i], callback);
            }
        },
        ElementNode: function (walker, node, callback) {
            for (var i = 0; i < node.children.length; i++) {
                walker.visit(node.children[i], callback);
            }
        },
        BlockStatement: function (walker, node, callback) {
            walker.visit(node.program, callback);
            walker.visit(node.inverse, callback);
        }
    };
    Walker.prototype.children = function (node, callback) {
        var visitor = visitors[node.type];
        if (visitor) {
            visitor(this, node, callback);
        }
    };

    // Regex to validate the identifier for block parameters.
    // Based on the ID validation regex in Handlebars.
    var ID_INVERSE_PATTERN = /[!"#%-,\.\/;->@\[-\^`\{-~]/;
    // Checks the element's attributes to see if it uses block params.
    // If it does, registers the block params with the program and
    // removes the corresponding attributes from the element.
    function parseElementBlockParams(element) {
        var params = parseBlockParams(element);
        if (params) element.blockParams = params;
    }
    function parseBlockParams(element) {
        var l = element.attributes.length;
        var attrNames = [];
        for (var i = 0; i < l; i++) {
            attrNames.push(element.attributes[i].name);
        }
        var asIndex = attrNames.indexOf('as');
        if (asIndex !== -1 && l > asIndex && attrNames[asIndex + 1].charAt(0) === '|') {
            // Some basic validation, since we're doing the parsing ourselves
            var paramsString = attrNames.slice(asIndex).join(' ');
            if (paramsString.charAt(paramsString.length - 1) !== '|' || paramsString.match(/\|/g).length !== 2) {
                throw new Error('Invalid block parameters syntax: \'' + paramsString + '\'');
            }
            var params = [];
            for (var i = asIndex + 1; i < l; i++) {
                var param = attrNames[i].replace(/\|/g, '');
                if (param !== '') {
                    if (ID_INVERSE_PATTERN.test(param)) {
                        throw new Error('Invalid identifier for block parameters: \'' + param + '\' in \'' + paramsString + '\'');
                    }
                    params.push(param);
                }
            }
            if (params.length === 0) {
                throw new Error('Cannot use zero block parameters: \'' + paramsString + '\'');
            }
            element.attributes = element.attributes.slice(0, asIndex);
            return params;
        }
    }
    function childrenFor(node) {
        if (node.type === 'Program') {
            return node.body;
        }
        if (node.type === 'ElementNode') {
            return node.children;
        }
    }
    function appendChild(parent, node) {
        childrenFor(parent).push(node);
    }

    var handlebarsNodeVisitors = {
        Program: function (program) {
            var body = [];
            var node = b.program(body, program.blockParams, program.loc);
            var i = undefined,
                l = program.body.length;
            this.elementStack.push(node);
            if (l === 0) {
                return this.elementStack.pop();
            }
            for (i = 0; i < l; i++) {
                this.acceptNode(program.body[i]);
            }
            // Ensure that that the element stack is balanced properly.
            var poppedNode = this.elementStack.pop();
            if (poppedNode !== node) {
                throw new Error("Unclosed element `" + poppedNode.tag + "` (on line " + poppedNode.loc.start.line + ").");
            }
            return node;
        },
        BlockStatement: function (block) {
            delete block.inverseStrip;
            delete block.openString;
            delete block.closeStrip;
            if (this.tokenizer.state === 'comment') {
                this.appendToCommentData('{{' + this.sourceForMustache(block) + '}}');
                return;
            }
            if (this.tokenizer.state !== 'comment' && this.tokenizer.state !== 'data' && this.tokenizer.state !== 'beforeData') {
                throw new Error("A block may only be used inside an HTML element or another block.");
            }
            block = acceptCommonNodes(this, block);
            var program = block.program ? this.acceptNode(block.program) : null;
            var inverse = block.inverse ? this.acceptNode(block.inverse) : null;
            var node = b.block(block.path, block.params, block.hash, program, inverse, block.loc);
            var parentProgram = this.currentElement();
            appendChild(parentProgram, node);
        },
        MustacheStatement: function (rawMustache) {
            var tokenizer = this.tokenizer;
            var path = rawMustache.path;
            var params = rawMustache.params;
            var hash = rawMustache.hash;
            var escaped = rawMustache.escaped;
            var loc = rawMustache.loc;

            var mustache = b.mustache(path, params, hash, !escaped, loc);
            if (tokenizer.state === 'comment') {
                this.appendToCommentData('{{' + this.sourceForMustache(mustache) + '}}');
                return;
            }
            acceptCommonNodes(this, mustache);
            switch (tokenizer.state) {
                // Tag helpers
                case "tagName":
                    addElementModifier(this.currentNode, mustache);
                    tokenizer.state = "beforeAttributeName";
                    break;
                case "beforeAttributeName":
                    addElementModifier(this.currentNode, mustache);
                    break;
                case "attributeName":
                case "afterAttributeName":
                    this.beginAttributeValue(false);
                    this.finishAttributeValue();
                    addElementModifier(this.currentNode, mustache);
                    tokenizer.state = "beforeAttributeName";
                    break;
                case "afterAttributeValueQuoted":
                    addElementModifier(this.currentNode, mustache);
                    tokenizer.state = "beforeAttributeName";
                    break;
                // Attribute values
                case "beforeAttributeValue":
                    appendDynamicAttributeValuePart(this.currentAttribute, mustache);
                    tokenizer.state = 'attributeValueUnquoted';
                    break;
                case "attributeValueDoubleQuoted":
                case "attributeValueSingleQuoted":
                case "attributeValueUnquoted":
                    appendDynamicAttributeValuePart(this.currentAttribute, mustache);
                    break;
                // TODO: Only append child when the tokenizer state makes
                // sense to do so, otherwise throw an error.
                default:
                    appendChild(this.currentElement(), mustache);
            }
            return mustache;
        },
        ContentStatement: function (content) {
            updateTokenizerLocation(this.tokenizer, content);
            this.tokenizer.tokenizePart(content.value);
            this.tokenizer.flushData();
        },
        CommentStatement: function (rawComment) {
            var tokenizer = this.tokenizer;
            var value = rawComment.value;
            var loc = rawComment.loc;

            var comment = b.mustacheComment(value, loc);
            if (tokenizer.state === 'comment') {
                this.appendToCommentData('{{' + this.sourceForMustache(comment) + '}}');
                return;
            }
            switch (tokenizer.state) {
                case "beforeAttributeName":
                    this.currentNode.comments.push(comment);
                    break;
                case 'beforeData':
                case 'data':
                    appendChild(this.currentElement(), comment);
                    break;
                default:
                    throw new Error('Using a Handlebars comment when in the `' + tokenizer.state + '` state is not supported: "' + comment.value + '" on line ' + loc.start.line + ':' + loc.start.column);
            }
            return comment;
        },
        PartialStatement: function (partial) {
            appendChild(this.currentElement(), partial);
            return partial;
        },
        SubExpression: function (sexpr) {
            return acceptCommonNodes(this, sexpr);
        },
        PathExpression: function (path) {
            var original = path.original;
            var loc = path.loc;

            if (original.indexOf('/') !== -1) {
                // TODO add a SyntaxError with loc info
                if (original.slice(0, 2) === './') {
                    throw new Error('Using "./" is not supported in Glimmer and unnecessary: "' + path.original + '" on line ' + loc.start.line + '.');
                }
                if (original.slice(0, 3) === '../') {
                    throw new Error('Changing context using "../" is not supported in Glimmer: "' + path.original + '" on line ' + loc.start.line + '.');
                }
                if (original.indexOf('.') !== -1) {
                    throw new Error('Mixing \'.\' and \'/\' in paths is not supported in Glimmer; use only \'.\' to separate property paths: "' + path.original + '" on line ' + loc.start.line + '.');
                }
                path.parts = [path.parts.join('/')];
            }
            delete path.depth;
            // This is to fix a bug in the Handlebars AST where the path expressions in
            // `{{this.foo}}` (and similarly `{{foo-bar this.foo named=this.foo}}` etc)
            // are simply turned into `{{foo}}`. The fix is to push it back onto the
            // parts array and let the runtime see the difference. However, we cannot
            // simply use the string `this` as it means literally the property called
            // "this" in the current context (it can be expressed in the syntax as
            // `{{[this]}}`, where the square bracket are generally for this kind of
            // escaping – such as `{{foo.["bar.baz"]}}` would mean lookup a property
            // named literally "bar.baz" on `this.foo`). By convention, we use `null`
            // for this purpose.
            if (original.match(/^this(\..+)?$/)) {
                path.parts.unshift(null);
            }
            return path;
        },
        Hash: function (hash) {
            for (var i = 0; i < hash.pairs.length; i++) {
                this.acceptNode(hash.pairs[i].value);
            }
            return hash;
        },
        StringLiteral: function () {},
        BooleanLiteral: function () {},
        NumberLiteral: function () {},
        UndefinedLiteral: function () {},
        NullLiteral: function () {}
    };
    function calculateRightStrippedOffsets(original, value) {
        if (value === '') {
            // if it is empty, just return the count of newlines
            // in original
            return {
                lines: original.split("\n").length - 1,
                columns: 0
            };
        }
        // otherwise, return the number of newlines prior to
        // `value`
        var difference = original.split(value)[0];
        var lines = difference.split(/\n/);
        var lineCount = lines.length - 1;
        return {
            lines: lineCount,
            columns: lines[lineCount].length
        };
    }
    function updateTokenizerLocation(tokenizer, content) {
        var line = content.loc.start.line;
        var column = content.loc.start.column;
        if (content.rightStripped) {
            var offsets = calculateRightStrippedOffsets(content.original, content.value);
            line = line + offsets.lines;
            if (offsets.lines) {
                column = offsets.columns;
            } else {
                column = column + offsets.columns;
            }
        }
        tokenizer.line = line;
        tokenizer.column = column;
    }
    function acceptCommonNodes(compiler, node) {
        compiler.acceptNode(node.path);
        if (node.params) {
            for (var i = 0; i < node.params.length; i++) {
                compiler.acceptNode(node.params[i]);
            }
        } else {
            node.params = [];
        }
        if (node.hash) {
            compiler.acceptNode(node.hash);
        } else {
            node.hash = b.hash();
        }
        return node;
    }
    function addElementModifier(element, mustache) {
        var path = mustache.path;
        var params = mustache.params;
        var hash = mustache.hash;
        var loc = mustache.loc;

        var modifier = b.elementModifier(path, params, hash, loc);
        element.modifiers.push(modifier);
    }
    function appendDynamicAttributeValuePart(attribute, part) {
        attribute.isDynamic = true;
        attribute.parts.push(part);
    }

    var voidMap = Object.create(null);
    var voidTagNames = "area base br col command embed hr img input keygen link meta param source track wbr";
    voidTagNames.split(" ").forEach(function (tagName) {
        voidMap[tagName] = true;
    });
    var tokenizerEventHandlers = {
        reset: function () {
            this.currentNode = null;
        },
        // Comment
        beginComment: function () {
            this.currentNode = b.comment("");
            this.currentNode.loc = {
                source: null,
                start: b.pos(this.tagOpenLine, this.tagOpenColumn),
                end: null
            };
        },
        appendToCommentData: function (char) {
            this.currentNode.value += char;
        },
        finishComment: function () {
            this.currentNode.loc.end = b.pos(this.tokenizer.line, this.tokenizer.column);
            appendChild(this.currentElement(), this.currentNode);
        },
        // Data
        beginData: function () {
            this.currentNode = b.text();
            this.currentNode.loc = {
                source: null,
                start: b.pos(this.tokenizer.line, this.tokenizer.column),
                end: null
            };
        },
        appendToData: function (char) {
            this.currentNode.chars += char;
        },
        finishData: function () {
            this.currentNode.loc.end = b.pos(this.tokenizer.line, this.tokenizer.column);
            appendChild(this.currentElement(), this.currentNode);
        },
        // Tags - basic
        tagOpen: function () {
            this.tagOpenLine = this.tokenizer.line;
            this.tagOpenColumn = this.tokenizer.column;
        },
        beginStartTag: function () {
            this.currentNode = {
                type: 'StartTag',
                name: "",
                attributes: [],
                modifiers: [],
                comments: [],
                selfClosing: false,
                loc: null
            };
        },
        beginEndTag: function () {
            this.currentNode = {
                type: 'EndTag',
                name: "",
                attributes: [],
                modifiers: [],
                comments: [],
                selfClosing: false,
                loc: null
            };
        },
        finishTag: function () {
            var _tokenizer = this.tokenizer;
            var line = _tokenizer.line;
            var column = _tokenizer.column;

            var tag = this.currentNode;
            tag.loc = b.loc(this.tagOpenLine, this.tagOpenColumn, line, column);
            if (tag.type === 'StartTag') {
                this.finishStartTag();
                if (voidMap[tag.name] || tag.selfClosing) {
                    this.finishEndTag(true);
                }
            } else if (tag.type === 'EndTag') {
                this.finishEndTag(false);
            }
        },
        finishStartTag: function () {
            var _currentNode = this.currentNode;
            var name = _currentNode.name;
            var attributes = _currentNode.attributes;
            var modifiers = _currentNode.modifiers;
            var comments = _currentNode.comments;

            var loc = b.loc(this.tagOpenLine, this.tagOpenColumn);
            var element = b.element(name, attributes, modifiers, [], comments, loc);
            this.elementStack.push(element);
        },
        finishEndTag: function (isVoid) {
            var tag = this.currentNode;
            var element = this.elementStack.pop();
            var parent = this.currentElement();
            validateEndTag(tag, element, isVoid);
            element.loc.end.line = this.tokenizer.line;
            element.loc.end.column = this.tokenizer.column;
            parseElementBlockParams(element);
            appendChild(parent, element);
        },
        markTagAsSelfClosing: function () {
            this.currentNode.selfClosing = true;
        },
        // Tags - name
        appendToTagName: function (char) {
            this.currentNode.name += char;
        },
        // Tags - attributes
        beginAttribute: function () {
            var tag = this.currentNode;
            if (tag.type === 'EndTag') {
                throw new Error('Invalid end tag: closing tag must not have attributes, ' + ('in `' + tag.name + '` (on line ' + this.tokenizer.line + ').'));
            }
            this.currentAttribute = {
                name: "",
                parts: [],
                isQuoted: false,
                isDynamic: false,
                start: b.pos(this.tokenizer.line, this.tokenizer.column),
                valueStartLine: null,
                valueStartColumn: null
            };
        },
        appendToAttributeName: function (char) {
            this.currentAttribute.name += char;
        },
        beginAttributeValue: function (isQuoted) {
            this.currentAttribute.isQuoted = isQuoted;
            this.currentAttribute.valueStartLine = this.tokenizer.line;
            this.currentAttribute.valueStartColumn = this.tokenizer.column;
        },
        appendToAttributeValue: function (char) {
            var parts = this.currentAttribute.parts;
            if (typeof parts[parts.length - 1] === 'string') {
                parts[parts.length - 1] += char;
            } else {
                parts.push(char);
            }
        },
        finishAttributeValue: function () {
            var _currentAttribute = this.currentAttribute;
            var name = _currentAttribute.name;
            var parts = _currentAttribute.parts;
            var isQuoted = _currentAttribute.isQuoted;
            var isDynamic = _currentAttribute.isDynamic;
            var valueStartLine = _currentAttribute.valueStartLine;
            var valueStartColumn = _currentAttribute.valueStartColumn;

            var value = assembleAttributeValue(parts, isQuoted, isDynamic, this.tokenizer.line);
            value.loc = b.loc(valueStartLine, valueStartColumn, this.tokenizer.line, this.tokenizer.column);
            var loc = b.loc(this.currentAttribute.start.line, this.currentAttribute.start.column, this.tokenizer.line, this.tokenizer.column);
            var attribute = b.attr(name, value, loc);
            this.currentNode.attributes.push(attribute);
        },
        reportSyntaxError: function (message) {
            throw new Error('Syntax error at line ' + this.tokenizer.line + ' col ' + this.tokenizer.column + ': ' + message);
        }
    };
    function assembleAttributeValue(parts, isQuoted, isDynamic, line) {
        if (isDynamic) {
            if (isQuoted) {
                return assembleConcatenatedValue(parts);
            } else {
                if (parts.length === 1 || parts.length === 2 && parts[1] === '/') {
                    return parts[0];
                } else {
                    throw new Error('An unquoted attribute value must be a string or a mustache, ' + 'preceeded by whitespace or a \'=\' character, and ' + ('followed by whitespace, a \'>\' character, or \'/>\' (on line ' + line + ')'));
                }
            }
        } else {
            return b.text(parts.length > 0 ? parts[0] : "");
        }
    }
    function assembleConcatenatedValue(parts) {
        for (var i = 0; i < parts.length; i++) {
            var part = parts[i];
            if (typeof part === 'string') {
                parts[i] = b.text(parts[i]);
            } else {
                if (part.type !== 'MustacheStatement') {
                    throw new Error("Unsupported node in quoted attribute value: " + part.type);
                }
            }
        }
        return b.concat(parts);
    }
    function validateEndTag(tag, element, selfClosing) {
        var error = undefined;
        if (voidMap[tag.name] && !selfClosing) {
            // EngTag is also called by StartTag for void and self-closing tags (i.e.
            // <input> or <br />, so we need to check for that here. Otherwise, we would
            // throw an error for those cases.
            error = "Invalid end tag " + formatEndTagInfo(tag) + " (void elements cannot have end tags).";
        } else if (element.tag === undefined) {
            error = "Closing tag " + formatEndTagInfo(tag) + " without an open tag.";
        } else if (element.tag !== tag.name) {
            error = "Closing tag " + formatEndTagInfo(tag) + " did not match last open tag `" + element.tag + "` (on line " + element.loc.start.line + ").";
        }
        if (error) {
            throw new Error(error);
        }
    }
    function formatEndTagInfo(tag) {
        return "`" + tag.name + "` (on line " + tag.loc.end.line + ")";
    }

    var syntax = {
        parse: preprocess,
        builders: b,
        print: build,
        traverse: traverse,
        Walker: Walker
    };
    function preprocess(html, options) {
        var ast = typeof html === 'object' ? html : _handlebars.parse(html);
        var combined = new Parser(html, options).acceptNode(ast);
        if (options && options.plugins && options.plugins.ast) {
            for (var i = 0, l = options.plugins.ast.length; i < l; i++) {
                var plugin = new options.plugins.ast[i](options);
                plugin.syntax = syntax;
                combined = plugin.transform(combined);
            }
        }
        return combined;
    }
    var entityParser = new _simpleHtmlTokenizer.EntityParser(_simpleHtmlTokenizer.HTML5NamedCharRefs);
    function Parser(source, options) {
        this.options = options || {};
        this.elementStack = [];
        this.tokenizer = new _simpleHtmlTokenizer.EventedTokenizer(this, entityParser);
        this.currentNode = null;
        this.currentAttribute = null;
        if (typeof source === 'string') {
            this.source = source.split(/(?:\r\n?|\n)/g);
        }
    }
    for (var key in handlebarsNodeVisitors) {
        Parser.prototype[key] = handlebarsNodeVisitors[key];
    }
    for (var key in tokenizerEventHandlers) {
        Parser.prototype[key] = tokenizerEventHandlers[key];
    }
    Parser.prototype.acceptNode = function (node) {
        return this[node.type](node);
    };
    Parser.prototype.currentElement = function () {
        return this.elementStack[this.elementStack.length - 1];
    };
    Parser.prototype.sourceForMustache = function (mustache) {
        var firstLine = mustache.loc.start.line - 1;
        var lastLine = mustache.loc.end.line - 1;
        var currentLine = firstLine - 1;
        var firstColumn = mustache.loc.start.column + 2;
        var lastColumn = mustache.loc.end.column - 2;
        var string = [];
        var line = undefined;
        if (!this.source) {
            return '{{' + mustache.path.id.original + '}}';
        }
        while (currentLine < lastLine) {
            currentLine++;
            line = this.source[currentLine];
            if (currentLine === firstLine) {
                if (firstLine === lastLine) {
                    string.push(line.slice(firstColumn, lastColumn));
                } else {
                    string.push(line.slice(firstColumn));
                }
            } else if (currentLine === lastLine) {
                string.push(line.slice(0, lastColumn));
            } else {
                string.push(line);
            }
        }
        return string.join('\n');
    };

    exports.preprocess = preprocess;
    exports.builders = b;
    exports.traverse = traverse;
    exports.Walker = Walker;
    exports.print = build;
});
enifed('@glimmer/util', ['exports'], function (exports) {
    // There is a small whitelist of namespaced attributes specially
    // enumerated in
    // https://www.w3.org/TR/html/syntax.html#attributes-0
    //
    // > When a foreign element has one of the namespaced attributes given by
    // > the local name and namespace of the first and second cells of a row
    // > from the following table, it must be written using the name given by
    // > the third cell from the same row.
    //
    // In all other cases, colons are interpreted as a regular character
    // with no special meaning:
    //
    // > No other namespaced attribute can be expressed in the HTML syntax.
    'use strict';

    var XLINK = 'http://www.w3.org/1999/xlink';
    var XML = 'http://www.w3.org/XML/1998/namespace';
    var XMLNS = 'http://www.w3.org/2000/xmlns/';
    var WHITELIST = {
        'xlink:actuate': XLINK,
        'xlink:arcrole': XLINK,
        'xlink:href': XLINK,
        'xlink:role': XLINK,
        'xlink:show': XLINK,
        'xlink:title': XLINK,
        'xlink:type': XLINK,
        'xml:base': XML,
        'xml:lang': XML,
        'xml:space': XML,
        'xmlns': XMLNS,
        'xmlns:xlink': XMLNS
    };
    function getAttrNamespace(attrName) {
        return WHITELIST[attrName] || null;
    }

    // tslint:disable-line
    function unwrap(val) {
        if (val === null || val === undefined) throw new Error('Expected value to be present');
        return val;
    }
    function expect(val, message) {
        if (val === null || val === undefined) throw new Error(message);
        return val;
    }
    function unreachable() {
        return new Error('unreachable');
    }

    // import Logger from './logger';
    // let alreadyWarned = false;
    // import Logger from './logger';
    function debugAssert(test, msg) {
        // if (!alreadyWarned) {
        //   alreadyWarned = true;
        //   Logger.warn("Don't leave debug assertions on in public builds");
        // }
        if (!test) {
            throw new Error(msg || "assertion failure");
        }
    }

    var LogLevel;
    (function (LogLevel) {
        LogLevel[LogLevel["Trace"] = 0] = "Trace";
        LogLevel[LogLevel["Debug"] = 1] = "Debug";
        LogLevel[LogLevel["Warn"] = 2] = "Warn";
        LogLevel[LogLevel["Error"] = 3] = "Error";
    })(LogLevel || (exports.LogLevel = LogLevel = {}));

    var NullConsole = (function () {
        function NullConsole() {}

        NullConsole.prototype.log = function log(_message) {};

        NullConsole.prototype.warn = function warn(_message) {};

        NullConsole.prototype.error = function error(_message) {};

        NullConsole.prototype.trace = function trace() {};

        return NullConsole;
    })();

    var ALWAYS = undefined;

    var Logger = (function () {
        function Logger(_ref) {
            var console = _ref.console;
            var level = _ref.level;

            this.f = ALWAYS;
            this.force = ALWAYS;
            this.console = console;
            this.level = level;
        }

        Logger.prototype.skipped = function skipped(level) {
            return level < this.level;
        };

        Logger.prototype.trace = function trace(message) {
            var _ref2 = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

            var _ref2$stackTrace = _ref2.stackTrace;
            var stackTrace = _ref2$stackTrace === undefined ? false : _ref2$stackTrace;

            if (this.skipped(LogLevel.Trace)) return;
            this.console.log(message);
            if (stackTrace) this.console.trace();
        };

        Logger.prototype.debug = function debug(message) {
            var _ref3 = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

            var _ref3$stackTrace = _ref3.stackTrace;
            var stackTrace = _ref3$stackTrace === undefined ? false : _ref3$stackTrace;

            if (this.skipped(LogLevel.Debug)) return;
            this.console.log(message);
            if (stackTrace) this.console.trace();
        };

        Logger.prototype.warn = function warn(message) {
            var _ref4 = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

            var _ref4$stackTrace = _ref4.stackTrace;
            var stackTrace = _ref4$stackTrace === undefined ? false : _ref4$stackTrace;

            if (this.skipped(LogLevel.Warn)) return;
            this.console.warn(message);
            if (stackTrace) this.console.trace();
        };

        Logger.prototype.error = function error(message) {
            if (this.skipped(LogLevel.Error)) return;
            this.console.error(message);
        };

        return Logger;
    })();

    var _console = typeof console === 'undefined' ? new NullConsole() : console;
    ALWAYS = new Logger({ console: _console, level: LogLevel.Trace });
    var LOG_LEVEL = LogLevel.Warn;
    var logger = new Logger({ console: _console, level: LOG_LEVEL });

    var objKeys = Object.keys;

    function assign(obj) {
        for (var i = 1; i < arguments.length; i++) {
            var assignment = arguments[i];
            if (assignment === null || typeof assignment !== 'object') continue;
            var keys = objKeys(assignment);
            for (var j = 0; j < keys.length; j++) {
                var key = keys[j];
                obj[key] = assignment[key];
            }
        }
        return obj;
    }
    function fillNulls(count) {
        var arr = new Array(count);
        for (var i = 0; i < count; i++) {
            arr[i] = null;
        }
        return arr;
    }

    var GUID = 0;
    function initializeGuid(object) {
        return object._guid = ++GUID;
    }
    function ensureGuid(object) {
        return object._guid || initializeGuid(object);
    }

    var proto = Object.create(null, {
        // without this, we will always still end up with (new
        // EmptyObject()).constructor === Object
        constructor: {
            value: undefined,
            enumerable: false,
            writable: true
        }
    });
    function EmptyObject() {}
    EmptyObject.prototype = proto;
    function dict() {
        // let d = Object.create(null);
        // d.x = 1;
        // delete d.x;
        // return d;
        return new EmptyObject();
    }

    var DictSet = (function () {
        function DictSet() {
            this.dict = dict();
        }

        DictSet.prototype.add = function add(obj) {
            if (typeof obj === 'string') this.dict[obj] = obj;else this.dict[ensureGuid(obj)] = obj;
            return this;
        };

        DictSet.prototype.delete = function _delete(obj) {
            if (typeof obj === 'string') delete this.dict[obj];else if (obj._guid) delete this.dict[obj._guid];
        };

        DictSet.prototype.forEach = function forEach(callback) {
            var dict = this.dict;

            Object.keys(dict).forEach(function (key) {
                return callback(dict[key]);
            });
        };

        DictSet.prototype.toArray = function toArray() {
            return Object.keys(this.dict);
        };

        return DictSet;
    })();

    var Stack = (function () {
        function Stack() {
            this.stack = [];
            this.current = null;
        }

        Stack.prototype.toArray = function toArray() {
            return this.stack;
        };

        Stack.prototype.push = function push(item) {
            this.current = item;
            this.stack.push(item);
        };

        Stack.prototype.pop = function pop() {
            var item = this.stack.pop();
            var len = this.stack.length;
            this.current = len === 0 ? null : this.stack[len - 1];
            return item === undefined ? null : item;
        };

        Stack.prototype.isEmpty = function isEmpty() {
            return this.stack.length === 0;
        };

        return Stack;
    })();

    var ListNode = function ListNode(value) {
        this.next = null;
        this.prev = null;
        this.value = value;
    };

    var LinkedList = (function () {
        function LinkedList() {
            this.clear();
        }

        LinkedList.fromSlice = function fromSlice(slice) {
            var list = new LinkedList();
            slice.forEachNode(function (n) {
                return list.append(n.clone());
            });
            return list;
        };

        LinkedList.prototype.head = function head() {
            return this._head;
        };

        LinkedList.prototype.tail = function tail() {
            return this._tail;
        };

        LinkedList.prototype.clear = function clear() {
            this._head = this._tail = null;
        };

        LinkedList.prototype.isEmpty = function isEmpty() {
            return this._head === null;
        };

        LinkedList.prototype.toArray = function toArray() {
            var out = [];
            this.forEachNode(function (n) {
                return out.push(n);
            });
            return out;
        };

        LinkedList.prototype.splice = function splice(start, end, reference) {
            var before = undefined;
            if (reference === null) {
                before = this._tail;
                this._tail = end;
            } else {
                before = reference.prev;
                end.next = reference;
                reference.prev = end;
            }
            if (before) {
                before.next = start;
                start.prev = before;
            }
        };

        LinkedList.prototype.nextNode = function nextNode(node) {
            return node.next;
        };

        LinkedList.prototype.prevNode = function prevNode(node) {
            return node.prev;
        };

        LinkedList.prototype.forEachNode = function forEachNode(callback) {
            var node = this._head;
            while (node !== null) {
                callback(node);
                node = node.next;
            }
        };

        LinkedList.prototype.contains = function contains(needle) {
            var node = this._head;
            while (node !== null) {
                if (node === needle) return true;
                node = node.next;
            }
            return false;
        };

        LinkedList.prototype.insertBefore = function insertBefore(node) {
            var reference = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

            if (reference === null) return this.append(node);
            if (reference.prev) reference.prev.next = node;else this._head = node;
            node.prev = reference.prev;
            node.next = reference;
            reference.prev = node;
            return node;
        };

        LinkedList.prototype.append = function append(node) {
            var tail = this._tail;
            if (tail) {
                tail.next = node;
                node.prev = tail;
                node.next = null;
            } else {
                this._head = node;
            }
            return this._tail = node;
        };

        LinkedList.prototype.pop = function pop() {
            if (this._tail) return this.remove(this._tail);
            return null;
        };

        LinkedList.prototype.prepend = function prepend(node) {
            if (this._head) return this.insertBefore(node, this._head);
            return this._head = this._tail = node;
        };

        LinkedList.prototype.remove = function remove(node) {
            if (node.prev) node.prev.next = node.next;else this._head = node.next;
            if (node.next) node.next.prev = node.prev;else this._tail = node.prev;
            return node;
        };

        return LinkedList;
    })();

    var ListSlice = (function () {
        function ListSlice(head, tail) {
            this._head = head;
            this._tail = tail;
        }

        ListSlice.toList = function toList(slice) {
            var list = new LinkedList();
            slice.forEachNode(function (n) {
                return list.append(n.clone());
            });
            return list;
        };

        ListSlice.prototype.forEachNode = function forEachNode(callback) {
            var node = this._head;
            while (node !== null) {
                callback(node);
                node = this.nextNode(node);
            }
        };

        ListSlice.prototype.contains = function contains(needle) {
            var node = this._head;
            while (node !== null) {
                if (node === needle) return true;
                node = node.next;
            }
            return false;
        };

        ListSlice.prototype.head = function head() {
            return this._head;
        };

        ListSlice.prototype.tail = function tail() {
            return this._tail;
        };

        ListSlice.prototype.toArray = function toArray() {
            var out = [];
            this.forEachNode(function (n) {
                return out.push(n);
            });
            return out;
        };

        ListSlice.prototype.nextNode = function nextNode(node) {
            if (node === this._tail) return null;
            return node.next;
        };

        ListSlice.prototype.prevNode = function prevNode(node) {
            if (node === this._head) return null;
            return node.prev;
        };

        ListSlice.prototype.isEmpty = function isEmpty() {
            return false;
        };

        return ListSlice;
    })();

    var EMPTY_SLICE = new ListSlice(null, null);

    var HAS_TYPED_ARRAYS = typeof Uint32Array !== 'undefined';
    var A = undefined;
    if (HAS_TYPED_ARRAYS) {
        A = Uint32Array;
    } else {
        A = Array;
    }
    var A$1 = A;

    var HAS_NATIVE_WEAKMAP = (function () {
        // detect if `WeakMap` is even present
        var hasWeakMap = typeof WeakMap === 'function';
        if (!hasWeakMap) {
            return false;
        }
        var instance = new WeakMap();
        // use `Object`'s `.toString` directly to prevent us from detecting
        // polyfills as native weakmaps
        return Object.prototype.toString.call(instance) === '[object WeakMap]';
    })();

    exports.getAttrNamespace = getAttrNamespace;
    exports.assert = debugAssert;
    exports.LOGGER = logger;
    exports.Logger = Logger;
    exports.LogLevel = LogLevel;
    exports.assign = assign;
    exports.fillNulls = fillNulls;
    exports.ensureGuid = ensureGuid;
    exports.initializeGuid = initializeGuid;
    exports.Stack = Stack;
    exports.DictSet = DictSet;
    exports.dict = dict;
    exports.EMPTY_SLICE = EMPTY_SLICE;
    exports.LinkedList = LinkedList;
    exports.ListNode = ListNode;
    exports.ListSlice = ListSlice;
    exports.A = A$1;
    exports.HAS_NATIVE_WEAKMAP = HAS_NATIVE_WEAKMAP;
    exports.unwrap = unwrap;
    exports.expect = expect;
    exports.unreachable = unreachable;
});
enifed('@glimmer/wire-format', ['exports'], function (exports) {
    'use strict';

    function is(variant) {
        return function (value) {
            return value[0] === variant;
        };
    }
    var Expressions;
    (function (Expressions) {
        Expressions.isUnknown = is('unknown');
        Expressions.isArg = is('arg');
        Expressions.isGet = is('get');
        Expressions.isConcat = is('concat');
        Expressions.isHelper = is('helper');
        Expressions.isHasBlock = is('has-block');
        Expressions.isHasBlockParams = is('has-block-params');
        Expressions.isUndefined = is('undefined');
        function isPrimitiveValue(value) {
            if (value === null) {
                return true;
            }
            return typeof value !== 'object';
        }
        Expressions.isPrimitiveValue = isPrimitiveValue;
    })(Expressions || (exports.Expressions = Expressions = {}));
    var Statements;
    (function (Statements) {
        Statements.isText = is('text');
        Statements.isAppend = is('append');
        Statements.isComment = is('comment');
        Statements.isModifier = is('modifier');
        Statements.isBlock = is('block');
        Statements.isComponent = is('component');
        Statements.isOpenElement = is('open-element');
        Statements.isFlushElement = is('flush-element');
        Statements.isCloseElement = is('close-element');
        Statements.isStaticAttr = is('static-attr');
        Statements.isDynamicAttr = is('dynamic-attr');
        Statements.isYield = is('yield');
        Statements.isPartial = is('partial');
        Statements.isDynamicArg = is('dynamic-arg');
        Statements.isStaticArg = is('static-arg');
        Statements.isTrustingAttr = is('trusting-attr');
        Statements.isDebugger = is('debugger');
        function isAttribute(val) {
            return val[0] === 'static-attr' || val[0] === 'dynamic-attr';
        }
        Statements.isAttribute = isAttribute;
        function isArgument(val) {
            return val[0] === 'static-arg' || val[0] === 'dynamic-arg';
        }
        Statements.isArgument = isArgument;
        function isParameter(val) {
            return isAttribute(val) || isArgument(val);
        }
        Statements.isParameter = isParameter;
        function getParameterName(s) {
            return s[1];
        }
        Statements.getParameterName = getParameterName;
    })(Statements || (exports.Statements = Statements = {}));

    exports.is = is;
    exports.Expressions = Expressions;
    exports.Statements = Statements;
});
enifed('backburner', ['exports'], function (exports) { 'use strict';

var NUMBER = /\d+/;

function each(collection, callback) {
  for (var i = 0; i < collection.length; i++) {
    callback(collection[i]);
  }
}

function isString(suspect) {
  return typeof suspect === 'string';
}

function isFunction(suspect) {
  return typeof suspect === 'function';
}

function isNumber(suspect) {
  return typeof suspect === 'number';
}

function isCoercableNumber(number) {
  return isNumber(number) || NUMBER.test(number);
}

function binarySearch(time, timers) {
  var start = 0;
  var end = timers.length - 2;
  var middle, l;

  while (start < end) {
    // since timers is an array of pairs 'l' will always
    // be an integer
    l = (end - start) / 2;

    // compensate for the index in case even number
    // of pairs inside timers
    middle = start + l - (l % 2);

    if (time >= timers[middle]) {
      start = middle + 2;
    } else {
      end = middle;
    }
  }

  return (time >= timers[start]) ? start + 2 : start;
}

function Queue(name, options, globalOptions) {
  this.name = name;
  this.globalOptions = globalOptions || {};
  this.options = options;
  this._queue = [];
  this.targetQueues = {};
  this._queueBeingFlushed = undefined;
}

Queue.prototype = {
  push: function(target, method, args, stack) {
    var queue = this._queue;
    queue.push(target, method, args, stack);

    return {
      queue: this,
      target: target,
      method: method
    };
  },

  pushUniqueWithoutGuid: function(target, method, args, stack) {
    var queue = this._queue;

    for (var i = 0, l = queue.length; i < l; i += 4) {
      var currentTarget = queue[i];
      var currentMethod = queue[i+1];

      if (currentTarget === target && currentMethod === method) {
        queue[i+2] = args;  // replace args
        queue[i+3] = stack; // replace stack
        return;
      }
    }

    queue.push(target, method, args, stack);
  },

  targetQueue: function(targetQueue, target, method, args, stack) {
    var queue = this._queue;

    for (var i = 0, l = targetQueue.length; i < l; i += 2) {
      var currentMethod = targetQueue[i];
      var currentIndex  = targetQueue[i + 1];

      if (currentMethod === method) {
        queue[currentIndex + 2] = args;  // replace args
        queue[currentIndex + 3] = stack; // replace stack
        return;
      }
    }

    targetQueue.push(
      method,
      queue.push(target, method, args, stack) - 4
    );
  },

  pushUniqueWithGuid: function(guid, target, method, args, stack) {
    var hasLocalQueue = this.targetQueues[guid];

    if (hasLocalQueue) {
      this.targetQueue(hasLocalQueue, target, method, args, stack);
    } else {
      this.targetQueues[guid] = [
        method,
        this._queue.push(target, method, args, stack) - 4
      ];
    }

    return {
      queue: this,
      target: target,
      method: method
    };
  },

  pushUnique: function(target, method, args, stack) {
    var KEY = this.globalOptions.GUID_KEY;

    if (target && KEY) {
      var guid = target[KEY];
      if (guid) {
        return this.pushUniqueWithGuid(guid, target, method, args, stack);
      }
    }

    this.pushUniqueWithoutGuid(target, method, args, stack);

    return {
      queue: this,
      target: target,
      method: method
    };
  },

  invoke: function(target, method, args /*, onError, errorRecordedForStack */) {
    if (args && args.length > 0) {
      method.apply(target, args);
    } else {
      method.call(target);
    }
  },

  invokeWithOnError: function(target, method, args, onError, errorRecordedForStack) {
    try {
      if (args && args.length > 0) {
        method.apply(target, args);
      } else {
        method.call(target);
      }
    } catch(error) {
      onError(error, errorRecordedForStack);
    }
  },

  flush: function(sync) {
    var queue = this._queue;
    var length = queue.length;

    if (length === 0) {
      return;
    }

    var globalOptions = this.globalOptions;
    var options = this.options;
    var before = options && options.before;
    var after = options && options.after;
    var onError = globalOptions.onError || (globalOptions.onErrorTarget &&
                                            globalOptions.onErrorTarget[globalOptions.onErrorMethod]);
    var target, method, args, errorRecordedForStack;
    var invoke = onError ? this.invokeWithOnError : this.invoke;

    this.targetQueues = Object.create(null);
    var queueItems = this._queueBeingFlushed = this._queue.slice();
    this._queue = [];

    if (before) {
      before();
    }

    for (var i = 0; i < length; i += 4) {
      target                = queueItems[i];
      method                = queueItems[i+1];
      args                  = queueItems[i+2];
      errorRecordedForStack = queueItems[i+3]; // Debugging assistance

      if (isString(method)) {
        method = target[method];
      }

      // method could have been nullified / canceled during flush
      if (method) {
        //
        //    ** Attention intrepid developer **
        //
        //    To find out the stack of this task when it was scheduled onto
        //    the run loop, add the following to your app.js:
        //
        //    Ember.run.backburner.DEBUG = true; // NOTE: This slows your app, don't leave it on in production.
        //
        //    Once that is in place, when you are at a breakpoint and navigate
        //    here in the stack explorer, you can look at `errorRecordedForStack.stack`,
        //    which will be the captured stack when this job was scheduled.
        //
        //    One possible long-term solution is the following Chrome issue:
        //       https://bugs.chromium.org/p/chromium/issues/detail?id=332624
        //
        invoke(target, method, args, onError, errorRecordedForStack);
      }
    }

    if (after) {
      after();
    }

    this._queueBeingFlushed = undefined;

    if (sync !== false &&
        this._queue.length > 0) {
      // check if new items have been added
      this.flush(true);
    }
  },

  cancel: function(actionToCancel) {
    var queue = this._queue, currentTarget, currentMethod, i, l;
    var target = actionToCancel.target;
    var method = actionToCancel.method;
    var GUID_KEY = this.globalOptions.GUID_KEY;

    if (GUID_KEY && this.targetQueues && target) {
      var targetQueue = this.targetQueues[target[GUID_KEY]];

      if (targetQueue) {
        for (i = 0, l = targetQueue.length; i < l; i++) {
          if (targetQueue[i] === method) {
            targetQueue.splice(i, 1);
          }
        }
      }
    }

    for (i = 0, l = queue.length; i < l; i += 4) {
      currentTarget = queue[i];
      currentMethod = queue[i+1];

      if (currentTarget === target &&
          currentMethod === method) {
        queue.splice(i, 4);
        return true;
      }
    }

    // if not found in current queue
    // could be in the queue that is being flushed
    queue = this._queueBeingFlushed;

    if (!queue) {
      return;
    }

    for (i = 0, l = queue.length; i < l; i += 4) {
      currentTarget = queue[i];
      currentMethod = queue[i+1];

      if (currentTarget === target &&
          currentMethod === method) {
        // don't mess with array during flush
        // just nullify the method
        queue[i+1] = null;
        return true;
      }
    }
  }
};

function DeferredActionQueues(queueNames, options) {
  var queues = this.queues = {};
  this.queueNames = queueNames = queueNames || [];

  this.options = options;

  each(queueNames, function(queueName) {
    queues[queueName] = new Queue(queueName, options[queueName], options);
  });
}

function noSuchQueue(name) {
  throw new Error('You attempted to schedule an action in a queue (' + name + ') that doesn\'t exist');
}

function noSuchMethod(name) {
  throw new Error('You attempted to schedule an action in a queue (' + name + ') for a method that doesn\'t exist');
}

DeferredActionQueues.prototype = {
  schedule: function(name, target, method, args, onceFlag, stack) {
    var queues = this.queues;
    var queue = queues[name];

    if (!queue) {
      noSuchQueue(name);
    }

    if (!method) {
      noSuchMethod(name);
    }

    if (onceFlag) {
      return queue.pushUnique(target, method, args, stack);
    } else {
      return queue.push(target, method, args, stack);
    }
  },

  flush: function() {
    var queues = this.queues;
    var queueNames = this.queueNames;
    var queueName, queue;
    var queueNameIndex = 0;
    var numberOfQueues = queueNames.length;

    while (queueNameIndex < numberOfQueues) {
      queueName = queueNames[queueNameIndex];
      queue = queues[queueName];

      var numberOfQueueItems = queue._queue.length;

      if (numberOfQueueItems === 0) {
        queueNameIndex++;
      } else {
        queue.flush(false /* async */);
        queueNameIndex = 0;
      }
    }
  }
};

function Backburner(queueNames, options) {
  this.queueNames = queueNames;
  this.options = options || {};
  if (!this.options.defaultQueue) {
    this.options.defaultQueue = queueNames[0];
  }
  this.instanceStack = [];
  this._debouncees = [];
  this._throttlers = [];
  this._eventCallbacks = {
    end: [],
    begin: []
  };

  var _this = this;
  this._boundClearItems = function() {
    clearItems();
  };

  this._timerTimeoutId = undefined;
  this._timers = [];

  this._platform = this.options._platform || {
    setTimeout: function (fn, ms) {
      return setTimeout(fn, ms);
    },
    clearTimeout: function (id) {
      clearTimeout(id);
    }
  };

  this._boundRunExpiredTimers = function () {
    _this._runExpiredTimers();
  };
}

Backburner.prototype = {
  begin: function() {
    var options = this.options;
    var onBegin = options && options.onBegin;
    var previousInstance = this.currentInstance;

    if (previousInstance) {
      this.instanceStack.push(previousInstance);
    }

    this.currentInstance = new DeferredActionQueues(this.queueNames, options);
    this._trigger('begin', this.currentInstance, previousInstance);
    if (onBegin) {
      onBegin(this.currentInstance, previousInstance);
    }
  },

  end: function() {
    var options = this.options;
    var onEnd = options && options.onEnd;
    var currentInstance = this.currentInstance;
    var nextInstance = null;

    // Prevent double-finally bug in Safari 6.0.2 and iOS 6
    // This bug appears to be resolved in Safari 6.0.5 and iOS 7
    var finallyAlreadyCalled = false;
    try {
      currentInstance.flush();
    } finally {
      if (!finallyAlreadyCalled) {
        finallyAlreadyCalled = true;

        this.currentInstance = null;

        if (this.instanceStack.length) {
          nextInstance = this.instanceStack.pop();
          this.currentInstance = nextInstance;
        }
        this._trigger('end', currentInstance, nextInstance);
        if (onEnd) {
          onEnd(currentInstance, nextInstance);
        }
      }
    }
  },

  /**
   Trigger an event. Supports up to two arguments. Designed around
   triggering transition events from one run loop instance to the
   next, which requires an argument for the first instance and then
   an argument for the next instance.

   @private
   @method _trigger
   @param {String} eventName
   @param {any} arg1
   @param {any} arg2
   */
  _trigger: function(eventName, arg1, arg2) {
    var callbacks = this._eventCallbacks[eventName];
    if (callbacks) {
      for (var i = 0; i < callbacks.length; i++) {
        callbacks[i](arg1, arg2);
      }
    }
  },

  on: function(eventName, callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    var callbacks = this._eventCallbacks[eventName];
    if (callbacks) {
      callbacks.push(callback);
    } else {
      throw new TypeError('Cannot on() event "' + eventName + '" because it does not exist');
    }
  },

  off: function(eventName, callback) {
    if (eventName) {
      var callbacks = this._eventCallbacks[eventName];
      var callbackFound = false;
      if (!callbacks) return;
      if (callback) {
        for (var i = 0; i < callbacks.length; i++) {
          if (callbacks[i] === callback) {
            callbackFound = true;
            callbacks.splice(i, 1);
            i--;
          }
        }
      }
      if (!callbackFound) {
        throw new TypeError('Cannot off() callback that does not exist');
      }
    } else {
      throw new TypeError('Cannot off() event "' + eventName + '" because it does not exist');
    }
  },

  run: function(/* target, method, args */) {
    var length = arguments.length;
    var method, target, args;

    if (length === 1) {
      method = arguments[0];
      target = null;
    } else {
      target = arguments[0];
      method = arguments[1];
    }

    if (isString(method)) {
      method = target[method];
    }

    if (length > 2) {
      args = new Array(length - 2);
      for (var i = 0, l = length - 2; i < l; i++) {
        args[i] = arguments[i + 2];
      }
    } else {
      args = [];
    }

    var onError = getOnError(this.options);

    this.begin();

    // guard against Safari 6's double-finally bug
    var didFinally = false;

    if (onError) {
      try {
        return method.apply(target, args);
      } catch(error) {
        onError(error);
      } finally {
        if (!didFinally) {
          didFinally = true;
          this.end();
        }
      }
    } else {
      try {
        return method.apply(target, args);
      } finally {
        if (!didFinally) {
          didFinally = true;
          this.end();
        }
      }
    }
  },

  /*
    Join the passed method with an existing queue and execute immediately,
    if there isn't one use `Backburner#run`.

    The join method is like the run method except that it will schedule into
    an existing queue if one already exists. In either case, the join method will
    immediately execute the passed in function and return its result.

    @method join
    @param {Object} target
    @param {Function} method The method to be executed
    @param {any} args The method arguments
    @return method result
  */
  join: function(/* target, method, args */) {
    if (!this.currentInstance) {
      return this.run.apply(this, arguments);
    }

    var length = arguments.length;
    var method, target;

    if (length === 1) {
      method = arguments[0];
      target = null;
    } else {
      target = arguments[0];
      method = arguments[1];
    }

    if (isString(method)) {
      method = target[method];
    }

    if (length === 1) {
      return method();
    } else if (length === 2) {
      return method.call(target);
    } else {
      var args = new Array(length - 2);
      for (var i = 0, l = length - 2; i < l; i++) {
        args[i] = arguments[i + 2];
      }
      return method.apply(target, args);
    }
  },


  /*
    Defer the passed function to run inside the specified queue.

    @method defer
    @param {String} queueName
    @param {Object} target
    @param {Function|String} method The method or method name to be executed
    @param {any} args The method arguments
    @return method result
  */
  defer: function(queueName /* , target, method, args */) {
    var length = arguments.length;
    var method, target, args;

    if (length === 2) {
      method = arguments[1];
      target = null;
    } else {
      target = arguments[1];
      method = arguments[2];
    }

    if (isString(method)) {
      method = target[method];
    }

    var stack = this.DEBUG ? new Error() : undefined;

    if (length > 3) {
      args = new Array(length - 3);
      for (var i = 3; i < length; i++) {
        args[i-3] = arguments[i];
      }
    } else {
      args = undefined;
    }

    if (!this.currentInstance) { createAutorun(this); }
    return this.currentInstance.schedule(queueName, target, method, args, false, stack);
  },

  deferOnce: function(queueName /* , target, method, args */) {
    var length = arguments.length;
    var method, target, args;

    if (length === 2) {
      method = arguments[1];
      target = null;
    } else {
      target = arguments[1];
      method = arguments[2];
    }

    if (isString(method)) {
      method = target[method];
    }

    var stack = this.DEBUG ? new Error() : undefined;

    if (length > 3) {
      args = new Array(length - 3);
      for (var i = 3; i < length; i++) {
        args[i-3] = arguments[i];
      }
    } else {
      args = undefined;
    }

    if (!this.currentInstance) {
      createAutorun(this);
    }
    return this.currentInstance.schedule(queueName, target, method, args, true, stack);
  },

  setTimeout: function() {
    var l = arguments.length;
    var args = new Array(l);

    for (var x = 0; x < l; x++) {
      args[x] = arguments[x];
    }

    var length = args.length,
        method, wait, target,
        methodOrTarget, methodOrWait, methodOrArgs;

    if (length === 0) {
      return;
    } else if (length === 1) {
      method = args.shift();
      wait = 0;
    } else if (length === 2) {
      methodOrTarget = args[0];
      methodOrWait = args[1];

      if (isFunction(methodOrWait) || isFunction(methodOrTarget[methodOrWait])) {
        target = args.shift();
        method = args.shift();
        wait = 0;
      } else if (isCoercableNumber(methodOrWait)) {
        method = args.shift();
        wait = args.shift();
      } else {
        method = args.shift();
        wait =  0;
      }
    } else {
      var last = args[args.length - 1];

      if (isCoercableNumber(last)) {
        wait = args.pop();
      } else {
        wait = 0;
      }

      methodOrTarget = args[0];
      methodOrArgs = args[1];

      if (isFunction(methodOrArgs) || (isString(methodOrArgs) &&
                                      methodOrTarget !== null &&
                                      methodOrArgs in methodOrTarget)) {
        target = args.shift();
        method = args.shift();
      } else {
        method = args.shift();
      }
    }

    var executeAt = Date.now() + parseInt(wait !== wait ? 0 : wait, 10);

    if (isString(method)) {
      method = target[method];
    }

    var onError = getOnError(this.options);

    function fn() {
      if (onError) {
        try {
          method.apply(target, args);
        } catch (e) {
          onError(e);
        }
      } else {
        method.apply(target, args);
      }
    }

    return this._setTimeout(fn, executeAt);
  },

  _setTimeout: function (fn, executeAt) {
    if (this._timers.length === 0) {
      this._timers.push(executeAt, fn);
      this._installTimerTimeout();
      return fn;
    }

    // find position to insert
    var i = binarySearch(executeAt, this._timers);

    this._timers.splice(i, 0, executeAt, fn);

    // we should be the new earliest timer if i == 0
    if (i === 0) {
      this._reinstallTimerTimeout();
    }

    return fn;
  },

  throttle: function(target, method /* , args, wait, [immediate] */) {
    var backburner = this;
    var args = new Array(arguments.length);
    for (var i = 0; i < arguments.length; i++) {
      args[i] = arguments[i];
    }
    var immediate = args.pop();
    var wait, throttler, index, timer;

    if (isNumber(immediate) || isString(immediate)) {
      wait = immediate;
      immediate = true;
    } else {
      wait = args.pop();
    }

    wait = parseInt(wait, 10);

    index = findThrottler(target, method, this._throttlers);
    if (index > -1) { return this._throttlers[index]; } // throttled

    timer = this._platform.setTimeout(function() {
      if (!immediate) {
        backburner.run.apply(backburner, args);
      }
      var index = findThrottler(target, method, backburner._throttlers);
      if (index > -1) {
        backburner._throttlers.splice(index, 1);
      }
    }, wait);

    if (immediate) {
      this.run.apply(this, args);
    }

    throttler = [target, method, timer];

    this._throttlers.push(throttler);

    return throttler;
  },

  debounce: function(target, method /* , args, wait, [immediate] */) {
    var backburner = this;
    var args = new Array(arguments.length);
    for (var i = 0; i < arguments.length; i++) {
      args[i] = arguments[i];
    }

    var immediate = args.pop();
    var wait, index, debouncee, timer;

    if (isNumber(immediate) || isString(immediate)) {
      wait = immediate;
      immediate = false;
    } else {
      wait = args.pop();
    }

    wait = parseInt(wait, 10);
    // Remove debouncee
    index = findDebouncee(target, method, this._debouncees);

    if (index > -1) {
      debouncee = this._debouncees[index];
      this._debouncees.splice(index, 1);
      this._platform.clearTimeout(debouncee[2]);
    }

    timer = this._platform.setTimeout(function() {
      if (!immediate) {
        backburner.run.apply(backburner, args);
      }
      var index = findDebouncee(target, method, backburner._debouncees);
      if (index > -1) {
        backburner._debouncees.splice(index, 1);
      }
    }, wait);

    if (immediate && index === -1) {
      backburner.run.apply(backburner, args);
    }

    debouncee = [
      target,
      method,
      timer
    ];

    backburner._debouncees.push(debouncee);

    return debouncee;
  },

  cancelTimers: function() {
    each(this._throttlers, this._boundClearItems);
    this._throttlers = [];

    each(this._debouncees, this._boundClearItems);
    this._debouncees = [];

    this._clearTimerTimeout();
    this._timers = [];

    if (this._autorun) {
      this._platform.clearTimeout(this._autorun);
      this._autorun = null;
    }
  },

  hasTimers: function() {
    return !!this._timers.length || !!this._debouncees.length || !!this._throttlers.length || this._autorun;
  },

  cancel: function (timer) {
    var timerType = typeof timer;

    if (timer && timerType === 'object' && timer.queue && timer.method) { // we're cancelling a deferOnce
      return timer.queue.cancel(timer);
    } else if (timerType === 'function') { // we're cancelling a setTimeout
      for (var i = 0, l = this._timers.length; i < l; i += 2) {
        if (this._timers[i + 1] === timer) {
          this._timers.splice(i, 2); // remove the two elements
          if (i === 0) {
            this._reinstallTimerTimeout();
          }
          return true;
        }
      }
    } else if (Object.prototype.toString.call(timer) === '[object Array]'){ // we're cancelling a throttle or debounce
      return this._cancelItem(findThrottler, this._throttlers, timer) ||
               this._cancelItem(findDebouncee, this._debouncees, timer);
    } else {
      return; // timer was null or not a timer
    }
  },

  _cancelItem: function(findMethod, array, timer){
    var item, index;

    if (timer.length < 3) { return false; }

    index = findMethod(timer[0], timer[1], array);

    if (index > -1) {

      item = array[index];

      if (item[2] === timer[2]) {
        array.splice(index, 1);
        this._platform.clearTimeout(timer[2]);
        return true;
      }
    }

    return false;
  },

  _runExpiredTimers: function () {
    this._timerTimeoutId = undefined;
    this.run(this, this._scheduleExpiredTimers);
  },

  _scheduleExpiredTimers: function () {
    var n = Date.now();
    var timers = this._timers;
    var i = 0;
    var l = timers.length;
    for (; i < l; i += 2) {
      var executeAt = timers[i];
      var fn = timers[i+1];
      if (executeAt <= n) {
        this.schedule(this.options.defaultQueue, null, fn);
      } else {
        break;
      }
    }
    timers.splice(0, i);
    this._installTimerTimeout();
  },

  _reinstallTimerTimeout: function () {
    this._clearTimerTimeout();
    this._installTimerTimeout();
  },

  _clearTimerTimeout: function () {
    if (!this._timerTimeoutId) {
      return;
    }
    this._platform.clearTimeout(this._timerTimeoutId);
    this._timerTimeoutId = undefined;
  },

  _installTimerTimeout: function () {
    if (!this._timers.length) {
      return;
    }
    var minExpiresAt = this._timers[0];
    var n = Date.now();
    var wait = Math.max(0, minExpiresAt - n);
    this._timerTimeoutId = this._platform.setTimeout(this._boundRunExpiredTimers, wait);
  }
};

Backburner.prototype.schedule = Backburner.prototype.defer;
Backburner.prototype.scheduleOnce = Backburner.prototype.deferOnce;
Backburner.prototype.later = Backburner.prototype.setTimeout;

function getOnError(options) {
  return options.onError || (options.onErrorTarget && options.onErrorTarget[options.onErrorMethod]);
}

function createAutorun(backburner) {
  var setTimeout = backburner._platform.setTimeout;
  backburner.begin();
  backburner._autorun = setTimeout(function() {
    backburner._autorun = null;
    backburner.end();
  }, 0);
}

function findDebouncee(target, method, debouncees) {
  return findItem(target, method, debouncees);
}

function findThrottler(target, method, throttlers) {
  return findItem(target, method, throttlers);
}

function findItem(target, method, collection) {
  var item;
  var index = -1;

  for (var i = 0, l = collection.length; i < l; i++) {
    item = collection[i];
    if (item[0] === target && item[1] === method) {
      index = i;
      break;
    }
  }

  return index;
}

function clearItems(item) {
  this._platform.clearTimeout(item[2]);
}

exports['default'] = Backburner;

Object.defineProperty(exports, '__esModule', { value: true });

});
enifed('ember-console/index', ['exports', 'ember-environment'], function (exports, _emberEnvironment) {
  'use strict';

  function K() {}

  function consoleMethod(name) {
    var consoleObj = undefined;
    if (_emberEnvironment.context.imports.console) {
      consoleObj = _emberEnvironment.context.imports.console;
    } else if (typeof console !== 'undefined') {
      consoleObj = console;
    }

    var method = typeof consoleObj === 'object' ? consoleObj[name] : null;

    if (typeof method !== 'function') {
      return;
    }

    if (typeof method.bind === 'function') {
      return method.bind(consoleObj);
    }

    return function () {
      method.apply(consoleObj, arguments);
    };
  }

  function assertPolyfill(test, message) {
    if (!test) {
      try {
        // attempt to preserve the stack
        throw new Error('assertion failed: ' + message);
      } catch (error) {
        setTimeout(function () {
          throw error;
        }, 0);
      }
    }
  }

  /**
    Inside Ember-Metal, simply uses the methods from `imports.console`.
    Override this to provide more robust logging functionality.
  
    @class Logger
    @namespace Ember
    @public
  */
  exports.default = {
    /**
     Logs the arguments to the console.
     You can pass as many arguments as you want and they will be joined together with a space.
       ```javascript
      var foo = 1;
      Ember.Logger.log('log value of foo:', foo);
      // "log value of foo: 1" will be printed to the console
      ```
      @method log
     @for Ember.Logger
     @param {*} arguments
     @public
    */
    log: consoleMethod('log') || K,

    /**
     Prints the arguments to the console with a warning icon.
     You can pass as many arguments as you want and they will be joined together with a space.
       ```javascript
      Ember.Logger.warn('Something happened!');
      // "Something happened!" will be printed to the console with a warning icon.
      ```
      @method warn
     @for Ember.Logger
     @param {*} arguments
     @public
    */
    warn: consoleMethod('warn') || K,

    /**
     Prints the arguments to the console with an error icon, red text and a stack trace.
     You can pass as many arguments as you want and they will be joined together with a space.
       ```javascript
      Ember.Logger.error('Danger! Danger!');
      // "Danger! Danger!" will be printed to the console in red text.
      ```
      @method error
     @for Ember.Logger
     @param {*} arguments
     @public
    */
    error: consoleMethod('error') || K,

    /**
     Logs the arguments to the console.
     You can pass as many arguments as you want and they will be joined together with a space.
       ```javascript
      var foo = 1;
      Ember.Logger.info('log value of foo:', foo);
      // "log value of foo: 1" will be printed to the console
      ```
      @method info
     @for Ember.Logger
     @param {*} arguments
     @public
    */
    info: consoleMethod('info') || K,

    /**
     Logs the arguments to the console in blue text.
     You can pass as many arguments as you want and they will be joined together with a space.
       ```javascript
      var foo = 1;
      Ember.Logger.debug('log value of foo:', foo);
      // "log value of foo: 1" will be printed to the console
      ```
      @method debug
     @for Ember.Logger
     @param {*} arguments
     @public
    */
    debug: consoleMethod('debug') || consoleMethod('info') || K,

    /**
     If the value passed into `Ember.Logger.assert` is not truthy it will throw an error with a stack trace.
       ```javascript
      Ember.Logger.assert(true); // undefined
      Ember.Logger.assert(true === false); // Throws an Assertion failed error.
      Ember.Logger.assert(true === false, 'Something invalid'); // Throws an Assertion failed error with message.
      ```
      @method assert
     @for Ember.Logger
     @param {Boolean} bool Value to test
     @param {String} message Assertion message on failed
     @public
    */
    assert: consoleMethod('assert') || assertPolyfill
  };
});
enifed('ember-debug/deprecate', ['exports', 'ember-metal', 'ember-console', 'ember-environment', 'ember-debug/handlers'], function (exports, _emberMetal, _emberConsole, _emberEnvironment, _emberDebugHandlers) {
  /*global __fail__*/

  'use strict';

  exports.registerHandler = registerHandler;
  exports.default = deprecate;

  function registerHandler(handler) {
    _emberDebugHandlers.registerHandler('deprecate', handler);
  }

  function formatMessage(_message, options) {
    var message = _message;

    if (options && options.id) {
      message = message + (' [deprecation id: ' + options.id + ']');
    }

    if (options && options.url) {
      message += ' See ' + options.url + ' for more details.';
    }

    return message;
  }

  registerHandler(function logDeprecationToConsole(message, options) {
    var updatedMessage = formatMessage(message, options);

    _emberConsole.default.warn('DEPRECATION: ' + updatedMessage);
  });

  var captureErrorForStack = undefined;

  if (new Error().stack) {
    captureErrorForStack = function () {
      return new Error();
    };
  } else {
    captureErrorForStack = function () {
      try {
        __fail__.fail();
      } catch (e) {
        return e;
      }
    };
  }

  registerHandler(function logDeprecationStackTrace(message, options, next) {
    if (_emberEnvironment.ENV.LOG_STACKTRACE_ON_DEPRECATION) {
      var stackStr = '';
      var error = captureErrorForStack();
      var stack = undefined;

      if (error.stack) {
        if (error['arguments']) {
          // Chrome
          stack = error.stack.replace(/^\s+at\s+/gm, '').replace(/^([^\(]+?)([\n$])/gm, '{anonymous}($1)$2').replace(/^Object.<anonymous>\s*\(([^\)]+)\)/gm, '{anonymous}($1)').split('\n');
          stack.shift();
        } else {
          // Firefox
          stack = error.stack.replace(/(?:\n@:0)?\s+$/m, '').replace(/^\(/gm, '{anonymous}(').split('\n');
        }

        stackStr = '\n    ' + stack.slice(2).join('\n    ');
      }

      var updatedMessage = formatMessage(message, options);

      _emberConsole.default.warn('DEPRECATION: ' + updatedMessage + stackStr);
    } else {
      next.apply(undefined, arguments);
    }
  });

  registerHandler(function raiseOnDeprecation(message, options, next) {
    if (_emberEnvironment.ENV.RAISE_ON_DEPRECATION) {
      var updatedMessage = formatMessage(message);

      throw new _emberMetal.Error(updatedMessage);
    } else {
      next.apply(undefined, arguments);
    }
  });

  var missingOptionsDeprecation = 'When calling `Ember.deprecate` you ' + 'must provide an `options` hash as the third parameter.  ' + '`options` should include `id` and `until` properties.';
  exports.missingOptionsDeprecation = missingOptionsDeprecation;
  var missingOptionsIdDeprecation = 'When calling `Ember.deprecate` you must provide `id` in options.';
  exports.missingOptionsIdDeprecation = missingOptionsIdDeprecation;
  var missingOptionsUntilDeprecation = 'When calling `Ember.deprecate` you must provide `until` in options.';

  exports.missingOptionsUntilDeprecation = missingOptionsUntilDeprecation;
  /**
  @module ember
  @submodule ember-debug
  */

  /**
    Display a deprecation warning with the provided message and a stack trace
    (Chrome and Firefox only).
  
    * In a production build, this method is defined as an empty function (NOP).
    Uses of this method in Ember itself are stripped from the ember.prod.js build.
  
    @method deprecate
    @param {String} message A description of the deprecation.
    @param {Boolean} test A boolean. If falsy, the deprecation will be displayed.
    @param {Object} options
    @param {String} options.id A unique id for this deprecation. The id can be
      used by Ember debugging tools to change the behavior (raise, log or silence)
      for that specific deprecation. The id should be namespaced by dots, e.g.
      "view.helper.select".
    @param {string} options.until The version of Ember when this deprecation
      warning will be removed.
    @param {String} [options.url] An optional url to the transition guide on the
      emberjs.com website.
    @for Ember
    @public
    @since 1.0.0
  */

  function deprecate(message, test, options) {
    if (!options || !options.id && !options.until) {
      deprecate(missingOptionsDeprecation, false, {
        id: 'ember-debug.deprecate-options-missing',
        until: '3.0.0',
        url: 'http://emberjs.com/deprecations/v2.x/#toc_ember-debug-function-options'
      });
    }

    if (options && !options.id) {
      deprecate(missingOptionsIdDeprecation, false, {
        id: 'ember-debug.deprecate-id-missing',
        until: '3.0.0',
        url: 'http://emberjs.com/deprecations/v2.x/#toc_ember-debug-function-options'
      });
    }

    if (options && !options.until) {
      deprecate(missingOptionsUntilDeprecation, options && options.until, {
        id: 'ember-debug.deprecate-until-missing',
        until: '3.0.0',
        url: 'http://emberjs.com/deprecations/v2.x/#toc_ember-debug-function-options'
      });
    }

    _emberDebugHandlers.invoke.apply(undefined, ['deprecate'].concat(babelHelpers.slice.call(arguments)));
  }
});
enifed("ember-debug/handlers", ["exports"], function (exports) {
  "use strict";

  exports.registerHandler = registerHandler;
  exports.invoke = invoke;
  var HANDLERS = {};

  exports.HANDLERS = HANDLERS;

  function registerHandler(type, callback) {
    var nextHandler = HANDLERS[type] || function () {};

    HANDLERS[type] = function (message, options) {
      callback(message, options, nextHandler);
    };
  }

  function invoke(type, message, test, options) {
    if (test) {
      return;
    }

    var handlerForType = HANDLERS[type];

    if (!handlerForType) {
      return;
    }

    if (handlerForType) {
      handlerForType(message, options);
    }
  }
});
enifed('ember-debug/index', ['exports', 'ember-metal', 'ember-environment', 'ember-console', 'ember-debug/deprecate', 'ember-debug/warn'], function (exports, _emberMetal, _emberEnvironment, _emberConsole, _emberDebugDeprecate, _emberDebugWarn) {
  'use strict';

  exports._warnIfUsingStrippedFeatureFlags = _warnIfUsingStrippedFeatureFlags;

  /**
  @module ember
  @submodule ember-debug
  */

  /**
  @class Ember
  @public
  */

  /**
    Define an assertion that will throw an exception if the condition is not met.
  
    * In a production build, this method is defined as an empty function (NOP).
    Uses of this method in Ember itself are stripped from the ember.prod.js build.
  
    ```javascript
    // Test for truthiness
    Ember.assert('Must pass a valid object', obj);
  
    // Fail unconditionally
    Ember.assert('This code path should never be run');
    ```
  
    @method assert
    @param {String} desc A description of the assertion. This will become
      the text of the Error thrown if the assertion fails.
    @param {Boolean} test Must be truthy for the assertion to pass. If
      falsy, an exception will be thrown.
    @public
    @since 1.0.0
  */
  _emberMetal.setDebugFunction('assert', function assert(desc, test) {
    if (!test) {
      throw new _emberMetal.Error('Assertion Failed: ' + desc);
    }
  });

  /**
    Display a debug notice.
  
    * In a production build, this method is defined as an empty function (NOP).
    Uses of this method in Ember itself are stripped from the ember.prod.js build.
  
    ```javascript
    Ember.debug('I\'m a debug notice!');
    ```
  
    @method debug
    @param {String} message A debug message to display.
    @public
  */
  _emberMetal.setDebugFunction('debug', function debug(message) {
    _emberConsole.default.debug('DEBUG: ' + message);
  });

  /**
    Display an info notice.
  
    * In a production build, this method is defined as an empty function (NOP).
    Uses of this method in Ember itself are stripped from the ember.prod.js build.
  
    @method info
    @private
  */
  _emberMetal.setDebugFunction('info', function info() {
    _emberConsole.default.info.apply(undefined, arguments);
  });

  /**
    Alias an old, deprecated method with its new counterpart.
  
    Display a deprecation warning with the provided message and a stack trace
    (Chrome and Firefox only) when the assigned method is called.
  
    * In a production build, this method is defined as an empty function (NOP).
  
    ```javascript
    Ember.oldMethod = Ember.deprecateFunc('Please use the new, updated method', Ember.newMethod);
    ```
  
    @method deprecateFunc
    @param {String} message A description of the deprecation.
    @param {Object} [options] The options object for Ember.deprecate.
    @param {Function} func The new function called to replace its deprecated counterpart.
    @return {Function} A new function that wraps the original function with a deprecation warning
    @private
  */
  _emberMetal.setDebugFunction('deprecateFunc', function deprecateFunc() {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    if (args.length === 3) {
      var _ret = (function () {
        var message = args[0];
        var options = args[1];
        var func = args[2];

        return {
          v: function () {
            _emberMetal.deprecate(message, false, options);
            return func.apply(this, arguments);
          }
        };
      })();

      if (typeof _ret === 'object') return _ret.v;
    } else {
      var _ret2 = (function () {
        var message = args[0];
        var func = args[1];

        return {
          v: function () {
            _emberMetal.deprecate(message);
            return func.apply(this, arguments);
          }
        };
      })();

      if (typeof _ret2 === 'object') return _ret2.v;
    }
  });

  /**
    Run a function meant for debugging.
  
    * In a production build, this method is defined as an empty function (NOP).
    Uses of this method in Ember itself are stripped from the ember.prod.js build.
  
    ```javascript
    Ember.runInDebug(() => {
      Ember.Component.reopen({
        didInsertElement() {
          console.log("I'm happy");
        }
      });
    });
    ```
  
    @method runInDebug
    @param {Function} func The function to be executed.
    @since 1.5.0
    @public
  */
  _emberMetal.setDebugFunction('runInDebug', function runInDebug(func) {
    func();
  });

  _emberMetal.setDebugFunction('debugSeal', function debugSeal(obj) {
    Object.seal(obj);
  });

  _emberMetal.setDebugFunction('debugFreeze', function debugFreeze(obj) {
    Object.freeze(obj);
  });

  _emberMetal.setDebugFunction('deprecate', _emberDebugDeprecate.default);

  _emberMetal.setDebugFunction('warn', _emberDebugWarn.default);

  /**
    Will call `Ember.warn()` if ENABLE_OPTIONAL_FEATURES or
    any specific FEATURES flag is truthy.
  
    This method is called automatically in debug canary builds.
  
    @private
    @method _warnIfUsingStrippedFeatureFlags
    @return {void}
  */

  function _warnIfUsingStrippedFeatureFlags(FEATURES, knownFeatures, featuresWereStripped) {
    if (featuresWereStripped) {
      _emberMetal.warn('Ember.ENV.ENABLE_OPTIONAL_FEATURES is only available in canary builds.', !_emberEnvironment.ENV.ENABLE_OPTIONAL_FEATURES, { id: 'ember-debug.feature-flag-with-features-stripped' });

      var keys = Object.keys(FEATURES || {});
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key === 'isEnabled' || !(key in knownFeatures)) {
          continue;
        }

        _emberMetal.warn('FEATURE["' + key + '"] is set as enabled, but FEATURE flags are only available in canary builds.', !FEATURES[key], { id: 'ember-debug.feature-flag-with-features-stripped' });
      }
    }
  }

  if (!_emberMetal.isTesting()) {
    (function () {
      // Complain if they're using FEATURE flags in builds other than canary
      _emberMetal.FEATURES['features-stripped-test'] = true;
      var featuresWereStripped = true;

      if (_emberMetal.isFeatureEnabled('features-stripped-test')) {
        featuresWereStripped = false;
      }

      delete _emberMetal.FEATURES['features-stripped-test'];
      _warnIfUsingStrippedFeatureFlags(_emberEnvironment.ENV.FEATURES, _emberMetal.DEFAULT_FEATURES, featuresWereStripped);

      // Inform the developer about the Ember Inspector if not installed.
      var isFirefox = _emberEnvironment.environment.isFirefox;
      var isChrome = _emberEnvironment.environment.isChrome;

      if (typeof window !== 'undefined' && (isFirefox || isChrome) && window.addEventListener) {
        window.addEventListener('load', function () {
          if (document.documentElement && document.documentElement.dataset && !document.documentElement.dataset.emberExtension) {
            var downloadURL = undefined;

            if (isChrome) {
              downloadURL = 'https://chrome.google.com/webstore/detail/ember-inspector/bmdblncegkenkacieihfhpjfppoconhi';
            } else if (isFirefox) {
              downloadURL = 'https://addons.mozilla.org/en-US/firefox/addon/ember-inspector/';
            }

            _emberMetal.debug('For more advanced debugging, install the Ember Inspector from ' + downloadURL);
          }
        }, false);
      }
    })();
  }
  /**
    @public
    @class Ember.Debug
  */
  _emberMetal.default.Debug = {};

  /**
    Allows for runtime registration of handler functions that override the default deprecation behavior.
    Deprecations are invoked by calls to [Ember.deprecate](http://emberjs.com/api/classes/Ember.html#method_deprecate).
    The following example demonstrates its usage by registering a handler that throws an error if the
    message contains the word "should", otherwise defers to the default handler.
  
    ```javascript
    Ember.Debug.registerDeprecationHandler((message, options, next) => {
      if (message.indexOf('should') !== -1) {
        throw new Error(`Deprecation message with should: ${message}`);
      } else {
        // defer to whatever handler was registered before this one
        next(message, options);
      }
    });
    ```
  
    The handler function takes the following arguments:
  
    <ul>
      <li> <code>message</code> - The message received from the deprecation call.</li>
      <li> <code>options</code> - An object passed in with the deprecation call containing additional information including:</li>
        <ul>
          <li> <code>id</code> - An id of the deprecation in the form of <code>package-name.specific-deprecation</code>.</li>
          <li> <code>until</code> - The Ember version number the feature and deprecation will be removed in.</li>
        </ul>
      <li> <code>next</code> - A function that calls into the previously registered handler.</li>
    </ul>
  
    @public
    @static
    @method registerDeprecationHandler
    @param handler {Function} A function to handle deprecation calls.
    @since 2.1.0
  */
  _emberMetal.default.Debug.registerDeprecationHandler = _emberDebugDeprecate.registerHandler;
  /**
    Allows for runtime registration of handler functions that override the default warning behavior.
    Warnings are invoked by calls made to [Ember.warn](http://emberjs.com/api/classes/Ember.html#method_warn).
    The following example demonstrates its usage by registering a handler that does nothing overriding Ember's
    default warning behavior.
  
    ```javascript
    // next is not called, so no warnings get the default behavior
    Ember.Debug.registerWarnHandler(() => {});
    ```
  
    The handler function takes the following arguments:
  
    <ul>
      <li> <code>message</code> - The message received from the warn call. </li>
      <li> <code>options</code> - An object passed in with the warn call containing additional information including:</li>
        <ul>
          <li> <code>id</code> - An id of the warning in the form of <code>package-name.specific-warning</code>.</li>
        </ul>
      <li> <code>next</code> - A function that calls into the previously registered handler.</li>
    </ul>
  
    @public
    @static
    @method registerWarnHandler
    @param handler {Function} A function to handle warnings.
    @since 2.1.0
  */
  _emberMetal.default.Debug.registerWarnHandler = _emberDebugWarn.registerHandler;

  /*
    We are transitioning away from `ember.js` to `ember.debug.js` to make
    it much clearer that it is only for local development purposes.
  
    This flag value is changed by the tooling (by a simple string replacement)
    so that if `ember.js` (which must be output for backwards compat reasons) is
    used a nice helpful warning message will be printed out.
  */
  var runningNonEmberDebugJS = false;
  exports.runningNonEmberDebugJS = runningNonEmberDebugJS;
  if (runningNonEmberDebugJS) {
    _emberMetal.warn('Please use `ember.debug.js` instead of `ember.js` for development and debugging.');
  }
});
// reexports
enifed('ember-debug/warn', ['exports', 'ember-console', 'ember-metal', 'ember-debug/handlers'], function (exports, _emberConsole, _emberMetal, _emberDebugHandlers) {
  'use strict';

  exports.registerHandler = registerHandler;
  exports.default = warn;

  function registerHandler(handler) {
    _emberDebugHandlers.registerHandler('warn', handler);
  }

  registerHandler(function logWarning(message, options) {
    _emberConsole.default.warn('WARNING: ' + message);
    if ('trace' in _emberConsole.default) {
      _emberConsole.default.trace();
    }
  });

  var missingOptionsDeprecation = 'When calling `Ember.warn` you ' + 'must provide an `options` hash as the third parameter.  ' + '`options` should include an `id` property.';
  exports.missingOptionsDeprecation = missingOptionsDeprecation;
  var missingOptionsIdDeprecation = 'When calling `Ember.warn` you must provide `id` in options.';

  exports.missingOptionsIdDeprecation = missingOptionsIdDeprecation;
  /**
  @module ember
  @submodule ember-debug
  */

  /**
    Display a warning with the provided message.
  
    * In a production build, this method is defined as an empty function (NOP).
    Uses of this method in Ember itself are stripped from the ember.prod.js build.
  
    @method warn
    @param {String} message A warning to display.
    @param {Boolean} test An optional boolean. If falsy, the warning
      will be displayed.
    @param {Object} options An object that can be used to pass a unique
      `id` for this warning.  The `id` can be used by Ember debugging tools
      to change the behavior (raise, log, or silence) for that specific warning.
      The `id` should be namespaced by dots, e.g. "ember-debug.feature-flag-with-features-stripped"
    @for Ember
    @public
    @since 1.0.0
  */

  function warn(message, test, options) {
    if (!options) {
      _emberMetal.deprecate(missingOptionsDeprecation, false, {
        id: 'ember-debug.warn-options-missing',
        until: '3.0.0',
        url: 'http://emberjs.com/deprecations/v2.x/#toc_ember-debug-function-options'
      });
    }

    if (options && !options.id) {
      _emberMetal.deprecate(missingOptionsIdDeprecation, false, {
        id: 'ember-debug.warn-id-missing',
        until: '3.0.0',
        url: 'http://emberjs.com/deprecations/v2.x/#toc_ember-debug-function-options'
      });
    }

    _emberDebugHandlers.invoke.apply(undefined, ['warn'].concat(babelHelpers.slice.call(arguments)));
  }
});
enifed('ember-environment/global', ['exports'], function (exports) {
  /* globals global, window, self, mainContext */

  // from lodash to catch fake globals
  'use strict';

  function checkGlobal(value) {
    return value && value.Object === Object ? value : undefined;
  }

  // element ids can ruin global miss checks
  function checkElementIdShadowing(value) {
    return value && value.nodeType === undefined ? value : undefined;
  }

  // export real global
  exports.default = checkGlobal(checkElementIdShadowing(typeof global === 'object' && global)) || checkGlobal(typeof self === 'object' && self) || checkGlobal(typeof window === 'object' && window) || mainContext || // set before strict mode in Ember loader/wrapper
  new Function('return this')();
  // eval outside of strict mode
});
enifed('ember-environment/index', ['exports', 'ember-environment/global', 'ember-environment/utils'], function (exports, _emberEnvironmentGlobal, _emberEnvironmentUtils) {
  /* globals module */
  'use strict';

  /**
    The hash of environment variables used to control various configuration
    settings. To specify your own or override default settings, add the
    desired properties to a global hash named `EmberENV` (or `ENV` for
    backwards compatibility with earlier versions of Ember). The `EmberENV`
    hash must be created before loading Ember.
  
    @class EmberENV
    @type Object
    @public
  */
  var ENV = typeof _emberEnvironmentGlobal.default.EmberENV === 'object' && _emberEnvironmentGlobal.default.EmberENV || typeof _emberEnvironmentGlobal.default.ENV === 'object' && _emberEnvironmentGlobal.default.ENV || {};

  exports.ENV = ENV;
  // ENABLE_ALL_FEATURES was documented, but you can't actually enable non optional features.
  if (ENV.ENABLE_ALL_FEATURES) {
    ENV.ENABLE_OPTIONAL_FEATURES = true;
  }

  /**
    Determines whether Ember should add to `Array`, `Function`, and `String`
    native object prototypes, a few extra methods in order to provide a more
    friendly API.
  
    We generally recommend leaving this option set to true however, if you need
    to turn it off, you can add the configuration property
    `EXTEND_PROTOTYPES` to `EmberENV` and set it to `false`.
  
    Note, when disabled (the default configuration for Ember Addons), you will
    instead have to access all methods and functions from the Ember
    namespace.
  
    @property EXTEND_PROTOTYPES
    @type Boolean
    @default true
    @for EmberENV
    @public
  */
  ENV.EXTEND_PROTOTYPES = _emberEnvironmentUtils.normalizeExtendPrototypes(ENV.EXTEND_PROTOTYPES);

  /**
    The `LOG_STACKTRACE_ON_DEPRECATION` property, when true, tells Ember to log
    a full stack trace during deprecation warnings.
  
    @property LOG_STACKTRACE_ON_DEPRECATION
    @type Boolean
    @default true
    @for EmberENV
    @public
  */
  ENV.LOG_STACKTRACE_ON_DEPRECATION = _emberEnvironmentUtils.defaultTrue(ENV.LOG_STACKTRACE_ON_DEPRECATION);

  /**
    The `LOG_VERSION` property, when true, tells Ember to log versions of all
    dependent libraries in use.
  
    @property LOG_VERSION
    @type Boolean
    @default true
    @for EmberENV
    @public
  */
  ENV.LOG_VERSION = _emberEnvironmentUtils.defaultTrue(ENV.LOG_VERSION);

  // default false
  ENV.MODEL_FACTORY_INJECTIONS = _emberEnvironmentUtils.defaultFalse(ENV.MODEL_FACTORY_INJECTIONS);

  /**
    Debug parameter you can turn on. This will log all bindings that fire to
    the console. This should be disabled in production code. Note that you
    can also enable this from the console or temporarily.
  
    @property LOG_BINDINGS
    @for EmberENV
    @type Boolean
    @default false
    @public
  */
  ENV.LOG_BINDINGS = _emberEnvironmentUtils.defaultFalse(ENV.LOG_BINDINGS);

  ENV.RAISE_ON_DEPRECATION = _emberEnvironmentUtils.defaultFalse(ENV.RAISE_ON_DEPRECATION);

  // check if window exists and actually is the global
  var hasDOM = typeof window !== 'undefined' && window === _emberEnvironmentGlobal.default && window.document && window.document.createElement && !ENV.disableBrowserEnvironment; // is this a public thing?

  // legacy imports/exports/lookup stuff (should we keep this??)
  var originalContext = _emberEnvironmentGlobal.default.Ember || {};

  var context = {
    // import jQuery
    imports: originalContext.imports || _emberEnvironmentGlobal.default,
    // export Ember
    exports: originalContext.exports || _emberEnvironmentGlobal.default,
    // search for Namespaces
    lookup: originalContext.lookup || _emberEnvironmentGlobal.default
  };

  exports.context = context;
  // TODO: cleanup single source of truth issues with this stuff
  var environment = hasDOM ? {
    hasDOM: true,
    isChrome: !!window.chrome && !window.opera,
    isFirefox: typeof InstallTrigger !== 'undefined',
    isPhantom: !!window.callPhantom,
    location: window.location,
    history: window.history,
    userAgent: window.navigator.userAgent,
    window: window
  } : {
    hasDOM: false,
    isChrome: false,
    isFirefox: false,
    isPhantom: false,
    location: null,
    history: null,
    userAgent: 'Lynx (textmode)',
    window: null
  };
  exports.environment = environment;
});
enifed("ember-environment/utils", ["exports"], function (exports) {
  "use strict";

  exports.defaultTrue = defaultTrue;
  exports.defaultFalse = defaultFalse;
  exports.normalizeExtendPrototypes = normalizeExtendPrototypes;

  function defaultTrue(v) {
    return v === false ? false : true;
  }

  function defaultFalse(v) {
    return v === true ? true : false;
  }

  function normalizeExtendPrototypes(obj) {
    if (obj === false) {
      return { String: false, Array: false, Function: false };
    } else if (!obj || obj === true) {
      return { String: true, Array: true, Function: true };
    } else {
      return {
        String: defaultTrue(obj.String),
        Array: defaultTrue(obj.Array),
        Function: defaultTrue(obj.Function)
      };
    }
  }
});
enifed('ember-metal/alias', ['exports', 'ember-utils', 'ember-metal/debug', 'ember-metal/property_get', 'ember-metal/property_set', 'ember-metal/error', 'ember-metal/properties', 'ember-metal/computed', 'ember-metal/meta', 'ember-metal/dependent_keys'], function (exports, _emberUtils, _emberMetalDebug, _emberMetalProperty_get, _emberMetalProperty_set, _emberMetalError, _emberMetalProperties, _emberMetalComputed, _emberMetalMeta, _emberMetalDependent_keys) {
  'use strict';

  exports.default = alias;

  var CONSUMED = {};

  function alias(altKey) {
    return new AliasedProperty(altKey);
  }

  var AliasedProperty = (function (_Descriptor) {
    babelHelpers.inherits(AliasedProperty, _Descriptor);

    function AliasedProperty(altKey) {
      babelHelpers.classCallCheck(this, AliasedProperty);

      _Descriptor.call(this);
      this.isDescriptor = true;
      this.altKey = altKey;
      this._dependentKeys = [altKey];
    }

    AliasedProperty.prototype.setup = function setup(obj, keyName) {
      _emberMetalDebug.assert('Setting alias \'' + keyName + '\' on self', this.altKey !== keyName);
      var meta = _emberMetalMeta.meta(obj);
      if (meta.peekWatching(keyName)) {
        _emberMetalDependent_keys.addDependentKeys(this, obj, keyName, meta);
      }
    };

    AliasedProperty.prototype.teardown = function teardown(obj, keyName) {
      var meta = _emberMetalMeta.meta(obj);
      if (meta.peekWatching(keyName)) {
        _emberMetalDependent_keys.removeDependentKeys(this, obj, keyName, meta);
      }
    };

    AliasedProperty.prototype.willWatch = function willWatch(obj, keyName) {
      _emberMetalDependent_keys.addDependentKeys(this, obj, keyName, _emberMetalMeta.meta(obj));
    };

    AliasedProperty.prototype.didUnwatch = function didUnwatch(obj, keyName) {
      _emberMetalDependent_keys.removeDependentKeys(this, obj, keyName, _emberMetalMeta.meta(obj));
    };

    AliasedProperty.prototype.get = function get(obj, keyName) {
      var ret = _emberMetalProperty_get.get(obj, this.altKey);
      var meta = _emberMetalMeta.meta(obj);
      var cache = meta.writableCache();
      if (cache[keyName] !== CONSUMED) {
        cache[keyName] = CONSUMED;
        _emberMetalDependent_keys.addDependentKeys(this, obj, keyName, meta);
      }
      return ret;
    };

    AliasedProperty.prototype.set = function set(obj, keyName, value) {
      return _emberMetalProperty_set.set(obj, this.altKey, value);
    };

    AliasedProperty.prototype.readOnly = function readOnly() {
      this.set = AliasedProperty_readOnlySet;
      return this;
    };

    AliasedProperty.prototype.oneWay = function oneWay() {
      this.set = AliasedProperty_oneWaySet;
      return this;
    };

    return AliasedProperty;
  })(_emberMetalProperties.Descriptor);

  exports.AliasedProperty = AliasedProperty;

  function AliasedProperty_readOnlySet(obj, keyName, value) {
    throw new _emberMetalError.default('Cannot set read-only property \'' + keyName + '\' on object: ' + _emberUtils.inspect(obj));
  }

  function AliasedProperty_oneWaySet(obj, keyName, value) {
    _emberMetalProperties.defineProperty(obj, keyName, null);
    return _emberMetalProperty_set.set(obj, keyName, value);
  }

  // Backwards compatibility with Ember Data.
  AliasedProperty.prototype._meta = undefined;
  AliasedProperty.prototype.meta = _emberMetalComputed.ComputedProperty.prototype.meta;
});
enifed('ember-metal/binding', ['exports', 'ember-utils', 'ember-console', 'ember-environment', 'ember-metal/run_loop', 'ember-metal/debug', 'ember-metal/property_get', 'ember-metal/property_set', 'ember-metal/events', 'ember-metal/observer', 'ember-metal/path_cache'], function (exports, _emberUtils, _emberConsole, _emberEnvironment, _emberMetalRun_loop, _emberMetalDebug, _emberMetalProperty_get, _emberMetalProperty_set, _emberMetalEvents, _emberMetalObserver, _emberMetalPath_cache) {
  'use strict';

  exports.bind = bind;

  /**
  @module ember
  @submodule ember-metal
  */

  // ..........................................................
  // BINDING
  //

  var Binding = (function () {
    function Binding(toPath, fromPath) {
      babelHelpers.classCallCheck(this, Binding);

      // Configuration
      this._from = fromPath;
      this._to = toPath;
      this._oneWay = undefined;

      // State
      this._direction = undefined;
      this._readyToSync = undefined;
      this._fromObj = undefined;
      this._fromPath = undefined;
      this._toObj = undefined;
    }

    /**
      @class Binding
      @namespace Ember
      @deprecated See http://emberjs.com/deprecations/v2.x#toc_ember-binding
      @public
    */

    /**
      This copies the Binding so it can be connected to another object.
       @method copy
      @return {Ember.Binding} `this`
      @public
    */

    Binding.prototype.copy = function copy() {
      var copy = new Binding(this._to, this._from);
      if (this._oneWay) {
        copy._oneWay = true;
      }
      return copy;
    };

    // ..........................................................
    // CONFIG
    //

    /**
      This will set `from` property path to the specified value. It will not
      attempt to resolve this property path to an actual object until you
      connect the binding.
       The binding will search for the property path starting at the root object
      you pass when you `connect()` the binding. It follows the same rules as
      `get()` - see that method for more information.
       @method from
      @param {String} path The property path to connect to.
      @return {Ember.Binding} `this`
      @public
    */

    Binding.prototype.from = function from(path) {
      this._from = path;
      return this;
    };

    /**
      This will set the `to` property path to the specified value. It will not
      attempt to resolve this property path to an actual object until you
      connect the binding.
       The binding will search for the property path starting at the root object
      you pass when you `connect()` the binding. It follows the same rules as
      `get()` - see that method for more information.
       @method to
      @param {String|Tuple} path A property path or tuple.
      @return {Ember.Binding} `this`
      @public
    */

    Binding.prototype.to = function to(path) {
      this._to = path;
      return this;
    };

    /**
      Configures the binding as one way. A one-way binding will relay changes
      on the `from` side to the `to` side, but not the other way around. This
      means that if you change the `to` side directly, the `from` side may have
      a different value.
       @method oneWay
      @return {Ember.Binding} `this`
      @public
    */

    Binding.prototype.oneWay = function oneWay() {
      this._oneWay = true;
      return this;
    };

    /**
      @method toString
      @return {String} string representation of binding
      @public
    */

    Binding.prototype.toString = function toString() {
      var oneWay = this._oneWay ? '[oneWay]' : '';
      return 'Ember.Binding<' + _emberUtils.guidFor(this) + '>(' + this._from + ' -> ' + this._to + ')' + oneWay;
    };

    // ..........................................................
    // CONNECT AND SYNC
    //

    /**
      Attempts to connect this binding instance so that it can receive and relay
      changes. This method will raise an exception if you have not set the
      from/to properties yet.
       @method connect
      @param {Object} obj The root object for this binding.
      @return {Ember.Binding} `this`
      @public
    */

    Binding.prototype.connect = function connect(obj) {
      _emberMetalDebug.assert('Must pass a valid object to Ember.Binding.connect()', !!obj);

      var fromObj = undefined,
          fromPath = undefined,
          possibleGlobal = undefined;

      // If the binding's "from" path could be interpreted as a global, verify
      // whether the path refers to a global or not by consulting `Ember.lookup`.
      if (_emberMetalPath_cache.isGlobalPath(this._from)) {
        var _name = _emberMetalPath_cache.getFirstKey(this._from);
        possibleGlobal = _emberEnvironment.context.lookup[_name];

        if (possibleGlobal) {
          fromObj = possibleGlobal;
          fromPath = _emberMetalPath_cache.getTailPath(this._from);
        }
      }

      if (fromObj === undefined) {
        fromObj = obj;
        fromPath = this._from;
      }

      _emberMetalProperty_set.trySet(obj, this._to, _emberMetalProperty_get.get(fromObj, fromPath));

      // Add an observer on the object to be notified when the binding should be updated.
      _emberMetalObserver.addObserver(fromObj, fromPath, this, 'fromDidChange');

      // If the binding is a two-way binding, also set up an observer on the target.
      if (!this._oneWay) {
        _emberMetalObserver.addObserver(obj, this._to, this, 'toDidChange');
      }

      _emberMetalEvents.addListener(obj, 'willDestroy', this, 'disconnect');

      fireDeprecations(obj, this._to, this._from, possibleGlobal, this._oneWay, !possibleGlobal && !this._oneWay);

      this._readyToSync = true;
      this._fromObj = fromObj;
      this._fromPath = fromPath;
      this._toObj = obj;

      return this;
    };

    /**
      Disconnects the binding instance. Changes will no longer be relayed. You
      will not usually need to call this method.
       @method disconnect
      @return {Ember.Binding} `this`
      @public
    */

    Binding.prototype.disconnect = function disconnect() {
      _emberMetalDebug.assert('Must pass a valid object to Ember.Binding.disconnect()', !!this._toObj);

      // Remove an observer on the object so we're no longer notified of
      // changes that should update bindings.
      _emberMetalObserver.removeObserver(this._fromObj, this._fromPath, this, 'fromDidChange');

      // If the binding is two-way, remove the observer from the target as well.
      if (!this._oneWay) {
        _emberMetalObserver.removeObserver(this._toObj, this._to, this, 'toDidChange');
      }

      this._readyToSync = false; // Disable scheduled syncs...
      return this;
    };

    // ..........................................................
    // PRIVATE
    //

    /* Called when the from side changes. */

    Binding.prototype.fromDidChange = function fromDidChange(target) {
      this._scheduleSync('fwd');
    };

    /* Called when the to side changes. */

    Binding.prototype.toDidChange = function toDidChange(target) {
      this._scheduleSync('back');
    };

    Binding.prototype._scheduleSync = function _scheduleSync(dir) {
      var existingDir = this._direction;

      // If we haven't scheduled the binding yet, schedule it.
      if (existingDir === undefined) {
        _emberMetalRun_loop.default.schedule('sync', this, '_sync');
        this._direction = dir;
      }

      // If both a 'back' and 'fwd' sync have been scheduled on the same object,
      // default to a 'fwd' sync so that it remains deterministic.
      if (existingDir === 'back' && dir === 'fwd') {
        this._direction = 'fwd';
      }
    };

    Binding.prototype._sync = function _sync() {
      var _this = this;

      var log = _emberEnvironment.ENV.LOG_BINDINGS;

      var toObj = this._toObj;

      // Don't synchronize destroyed objects or disconnected bindings.
      if (toObj.isDestroyed || !this._readyToSync) {
        return;
      }

      // Get the direction of the binding for the object we are
      // synchronizing from.
      var direction = this._direction;

      var fromObj = this._fromObj;
      var fromPath = this._fromPath;

      this._direction = undefined;

      // If we're synchronizing from the remote object...
      if (direction === 'fwd') {
        (function () {
          var fromValue = _emberMetalProperty_get.get(fromObj, fromPath);
          if (log) {
            _emberConsole.default.log(' ', _this.toString(), '->', fromValue, fromObj);
          }
          if (_this._oneWay) {
            _emberMetalProperty_set.trySet(toObj, _this._to, fromValue);
          } else {
            _emberMetalObserver._suspendObserver(toObj, _this._to, _this, 'toDidChange', function () {
              _emberMetalProperty_set.trySet(toObj, this._to, fromValue);
            });
          }
          // If we're synchronizing *to* the remote object.
        })();
      } else if (direction === 'back') {
          (function () {
            var toValue = _emberMetalProperty_get.get(toObj, _this._to);
            if (log) {
              _emberConsole.default.log(' ', _this.toString(), '<-', toValue, toObj);
            }
            _emberMetalObserver._suspendObserver(fromObj, fromPath, _this, 'fromDidChange', function () {
              _emberMetalProperty_set.trySet(fromObj, fromPath, toValue);
            });
          })();
        }
    };

    return Binding;
  })();

  function fireDeprecations(obj, toPath, fromPath, deprecateGlobal, deprecateOneWay, deprecateAlias) {
    var deprecateGlobalMessage = '`Ember.Binding` is deprecated. Since you' + ' are binding to a global consider using a service instead.';
    var deprecateOneWayMessage = '`Ember.Binding` is deprecated. Since you' + ' are using a `oneWay` binding consider using a `readOnly` computed' + ' property instead.';
    var deprecateAliasMessage = '`Ember.Binding` is deprecated. Consider' + ' using an `alias` computed property instead.';

    var objectInfo = 'The `' + toPath + '` property of `' + obj + '` is an `Ember.Binding` connected to `' + fromPath + '`, but ';
    _emberMetalDebug.deprecate(objectInfo + deprecateGlobalMessage, !deprecateGlobal, {
      id: 'ember-metal.binding',
      until: '3.0.0',
      url: 'http://emberjs.com/deprecations/v2.x#toc_ember-binding'
    });
    _emberMetalDebug.deprecate(objectInfo + deprecateOneWayMessage, !deprecateOneWay, {
      id: 'ember-metal.binding',
      until: '3.0.0',
      url: 'http://emberjs.com/deprecations/v2.x#toc_ember-binding'
    });
    _emberMetalDebug.deprecate(objectInfo + deprecateAliasMessage, !deprecateAlias, {
      id: 'ember-metal.binding',
      until: '3.0.0',
      url: 'http://emberjs.com/deprecations/v2.x#toc_ember-binding'
    });
  }

  function mixinProperties(to, from) {
    for (var key in from) {
      if (from.hasOwnProperty(key)) {
        to[key] = from[key];
      }
    }
  }

  mixinProperties(Binding, {

    /*
      See `Ember.Binding.from`.
       @method from
      @static
    */
    from: function (from) {
      var C = this;
      return new C(undefined, from);
    },

    /*
      See `Ember.Binding.to`.
       @method to
      @static
    */
    to: function (to) {
      var C = this;
      return new C(to, undefined);
    }
  });
  /**
    An `Ember.Binding` connects the properties of two objects so that whenever
    the value of one property changes, the other property will be changed also.
  
    ## Automatic Creation of Bindings with `/^*Binding/`-named Properties.
  
    You do not usually create Binding objects directly but instead describe
    bindings in your class or object definition using automatic binding
    detection.
  
    Properties ending in a `Binding` suffix will be converted to `Ember.Binding`
    instances. The value of this property should be a string representing a path
    to another object or a custom binding instance created using Binding helpers
    (see "One Way Bindings"):
  
    ```
    valueBinding: "MyApp.someController.title"
    ```
  
    This will create a binding from `MyApp.someController.title` to the `value`
    property of your object instance automatically. Now the two values will be
    kept in sync.
  
    ## One Way Bindings
  
    One especially useful binding customization you can use is the `oneWay()`
    helper. This helper tells Ember that you are only interested in
    receiving changes on the object you are binding from. For example, if you
    are binding to a preference and you want to be notified if the preference
    has changed, but your object will not be changing the preference itself, you
    could do:
  
    ```
    bigTitlesBinding: Ember.Binding.oneWay("MyApp.preferencesController.bigTitles")
    ```
  
    This way if the value of `MyApp.preferencesController.bigTitles` changes the
    `bigTitles` property of your object will change also. However, if you
    change the value of your `bigTitles` property, it will not update the
    `preferencesController`.
  
    One way bindings are almost twice as fast to setup and twice as fast to
    execute because the binding only has to worry about changes to one side.
  
    You should consider using one way bindings anytime you have an object that
    may be created frequently and you do not intend to change a property; only
    to monitor it for changes (such as in the example above).
  
    ## Adding Bindings Manually
  
    All of the examples above show you how to configure a custom binding, but the
    result of these customizations will be a binding template, not a fully active
    Binding instance. The binding will actually become active only when you
    instantiate the object the binding belongs to. It is useful, however, to
    understand what actually happens when the binding is activated.
  
    For a binding to function it must have at least a `from` property and a `to`
    property. The `from` property path points to the object/key that you want to
    bind from while the `to` path points to the object/key you want to bind to.
  
    When you define a custom binding, you are usually describing the property
    you want to bind from (such as `MyApp.someController.value` in the examples
    above). When your object is created, it will automatically assign the value
    you want to bind `to` based on the name of your binding key. In the
    examples above, during init, Ember objects will effectively call
    something like this on your binding:
  
    ```javascript
    binding = Ember.Binding.from("valueBinding").to("value");
    ```
  
    This creates a new binding instance based on the template you provide, and
    sets the to path to the `value` property of the new object. Now that the
    binding is fully configured with a `from` and a `to`, it simply needs to be
    connected to become active. This is done through the `connect()` method:
  
    ```javascript
    binding.connect(this);
    ```
  
    Note that when you connect a binding you pass the object you want it to be
    connected to. This object will be used as the root for both the from and
    to side of the binding when inspecting relative paths. This allows the
    binding to be automatically inherited by subclassed objects as well.
  
    This also allows you to bind between objects using the paths you declare in
    `from` and `to`:
  
    ```javascript
    // Example 1
    binding = Ember.Binding.from("App.someObject.value").to("value");
    binding.connect(this);
  
    // Example 2
    binding = Ember.Binding.from("parentView.value").to("App.someObject.value");
    binding.connect(this);
    ```
  
    Now that the binding is connected, it will observe both the from and to side
    and relay changes.
  
    If you ever needed to do so (you almost never will, but it is useful to
    understand this anyway), you could manually create an active binding by
    using the `Ember.bind()` helper method. (This is the same method used by
    to setup your bindings on objects):
  
    ```javascript
    Ember.bind(MyApp.anotherObject, "value", "MyApp.someController.value");
    ```
  
    Both of these code fragments have the same effect as doing the most friendly
    form of binding creation like so:
  
    ```javascript
    MyApp.anotherObject = Ember.Object.create({
      valueBinding: "MyApp.someController.value",
  
      // OTHER CODE FOR THIS OBJECT...
    });
    ```
  
    Ember's built in binding creation method makes it easy to automatically
    create bindings for you. You should always use the highest-level APIs
    available, even if you understand how it works underneath.
  
    @class Binding
    @namespace Ember
    @since Ember 0.9
    @public
  */
  // Ember.Binding = Binding; ES6TODO: where to put this?

  /**
    Global helper method to create a new binding. Just pass the root object
    along with a `to` and `from` path to create and connect the binding.
  
    @method bind
    @for Ember
    @param {Object} obj The root object of the transform.
    @param {String} to The path to the 'to' side of the binding.
      Must be relative to obj.
    @param {String} from The path to the 'from' side of the binding.
      Must be relative to obj or a global path.
    @return {Ember.Binding} binding instance
    @public
  */

  function bind(obj, to, from) {
    return new Binding(to, from).connect(obj);
  }

  exports.Binding = Binding;
});
enifed('ember-metal/cache', ['exports', 'ember-utils', 'ember-metal/meta'], function (exports, _emberUtils, _emberMetalMeta) {
  'use strict';

  var Cache = (function () {
    function Cache(limit, func, key, store) {
      babelHelpers.classCallCheck(this, Cache);

      this.size = 0;
      this.misses = 0;
      this.hits = 0;
      this.limit = limit;
      this.func = func;
      this.key = key;
      this.store = store || new DefaultStore();
    }

    Cache.prototype.get = function get(obj) {
      var key = this.key === undefined ? obj : this.key(obj);
      var value = this.store.get(key);
      if (value === undefined) {
        this.misses++;
        value = this._set(key, this.func(obj));
      } else if (value === _emberMetalMeta.UNDEFINED) {
        this.hits++;
        value = undefined;
      } else {
        this.hits++;
        // nothing to translate
      }

      return value;
    };

    Cache.prototype.set = function set(obj, value) {
      var key = this.key === undefined ? obj : this.key(obj);
      return this._set(key, value);
    };

    Cache.prototype._set = function _set(key, value) {
      if (this.limit > this.size) {
        this.size++;
        if (value === undefined) {
          this.store.set(key, _emberMetalMeta.UNDEFINED);
        } else {
          this.store.set(key, value);
        }
      }

      return value;
    };

    Cache.prototype.purge = function purge() {
      this.store.clear();
      this.size = 0;
      this.hits = 0;
      this.misses = 0;
    };

    return Cache;
  })();

  exports.default = Cache;

  var DefaultStore = (function () {
    function DefaultStore() {
      babelHelpers.classCallCheck(this, DefaultStore);

      this.data = new _emberUtils.EmptyObject();
    }

    DefaultStore.prototype.get = function get(key) {
      return this.data[key];
    };

    DefaultStore.prototype.set = function set(key, value) {
      this.data[key] = value;
    };

    DefaultStore.prototype.clear = function clear() {
      this.data = new _emberUtils.EmptyObject();
    };

    return DefaultStore;
  })();
});
enifed('ember-metal/chains', ['exports', 'ember-utils', 'ember-metal/property_get', 'ember-metal/meta', 'ember-metal/watch_key', 'ember-metal/computed', 'ember-metal/watch_path'], function (exports, _emberUtils, _emberMetalProperty_get, _emberMetalMeta, _emberMetalWatch_key, _emberMetalComputed, _emberMetalWatch_path) {
  'use strict';

  exports.finishChains = finishChains;

  var FIRST_KEY = /^([^\.]+)/;

  function firstKey(path) {
    return path.match(FIRST_KEY)[0];
  }

  function isObject(obj) {
    return typeof obj === 'object' && obj;
  }

  function isVolatile(obj) {
    return !(isObject(obj) && obj.isDescriptor && obj._volatile === false);
  }

  var ChainWatchers = (function () {
    function ChainWatchers() {
      babelHelpers.classCallCheck(this, ChainWatchers);

      // chain nodes that reference a key in this obj by key
      // we only create ChainWatchers when we are going to add them
      // so create this upfront
      this.chains = new _emberUtils.EmptyObject();
    }

    ChainWatchers.prototype.add = function add(key, node) {
      var nodes = this.chains[key];
      if (nodes === undefined) {
        this.chains[key] = [node];
      } else {
        nodes.push(node);
      }
    };

    ChainWatchers.prototype.remove = function remove(key, node) {
      var nodes = this.chains[key];
      if (nodes) {
        for (var i = 0; i < nodes.length; i++) {
          if (nodes[i] === node) {
            nodes.splice(i, 1);
            break;
          }
        }
      }
    };

    ChainWatchers.prototype.has = function has(key, node) {
      var nodes = this.chains[key];
      if (nodes) {
        for (var i = 0; i < nodes.length; i++) {
          if (nodes[i] === node) {
            return true;
          }
        }
      }
      return false;
    };

    ChainWatchers.prototype.revalidateAll = function revalidateAll() {
      for (var key in this.chains) {
        this.notify(key, true, undefined);
      }
    };

    ChainWatchers.prototype.revalidate = function revalidate(key) {
      this.notify(key, true, undefined);
    };

    // key: the string key that is part of a path changed
    // revalidate: boolean; the chains that are watching this value should revalidate
    // callback: function that will be called with the object and path that
    //           will be/are invalidated by this key change, depending on
    //           whether the revalidate flag is passed

    ChainWatchers.prototype.notify = function notify(key, revalidate, callback) {
      var nodes = this.chains[key];
      if (nodes === undefined || nodes.length === 0) {
        return;
      }

      var affected = undefined;

      if (callback) {
        affected = [];
      }

      for (var i = 0; i < nodes.length; i++) {
        nodes[i].notify(revalidate, affected);
      }

      if (callback === undefined) {
        return;
      }

      // we gather callbacks so we don't notify them during revalidation
      for (var i = 0; i < affected.length; i += 2) {
        var obj = affected[i];
        var path = affected[i + 1];
        callback(obj, path);
      }
    };

    return ChainWatchers;
  })();

  function makeChainWatcher() {
    return new ChainWatchers();
  }

  function addChainWatcher(obj, keyName, node) {
    var m = _emberMetalMeta.meta(obj);
    m.writableChainWatchers(makeChainWatcher).add(keyName, node);
    _emberMetalWatch_key.watchKey(obj, keyName, m);
  }

  function removeChainWatcher(obj, keyName, node, _meta) {
    if (!isObject(obj)) {
      return;
    }

    var meta = _meta || _emberMetalMeta.peekMeta(obj);

    if (!meta || !meta.readableChainWatchers()) {
      return;
    }

    // make meta writable
    meta = _emberMetalMeta.meta(obj);

    meta.readableChainWatchers().remove(keyName, node);

    _emberMetalWatch_key.unwatchKey(obj, keyName, meta);
  }

  // A ChainNode watches a single key on an object. If you provide a starting
  // value for the key then the node won't actually watch it. For a root node
  // pass null for parent and key and object for value.

  var ChainNode = (function () {
    function ChainNode(parent, key, value) {
      babelHelpers.classCallCheck(this, ChainNode);

      this._parent = parent;
      this._key = key;

      // _watching is true when calling get(this._parent, this._key) will
      // return the value of this node.
      //
      // It is false for the root of a chain (because we have no parent)
      // and for global paths (because the parent node is the object with
      // the observer on it)
      this._watching = value === undefined;

      this._chains = undefined;
      this._object = undefined;
      this.count = 0;

      this._value = value;
      this._paths = {};
      if (this._watching) {
        var obj = parent.value();

        if (!isObject(obj)) {
          return;
        }

        this._object = obj;

        addChainWatcher(this._object, this._key, this);
      }
    }

    ChainNode.prototype.value = function value() {
      if (this._value === undefined && this._watching) {
        var obj = this._parent.value();
        this._value = lazyGet(obj, this._key);
      }
      return this._value;
    };

    ChainNode.prototype.destroy = function destroy() {
      if (this._watching) {
        var obj = this._object;
        if (obj) {
          removeChainWatcher(obj, this._key, this);
        }
        this._watching = false; // so future calls do nothing
      }
    };

    // copies a top level object only

    ChainNode.prototype.copy = function copy(obj) {
      var ret = new ChainNode(null, null, obj);
      var paths = this._paths;
      var path = undefined;

      for (path in paths) {
        // this check will also catch non-number vals.
        if (paths[path] <= 0) {
          continue;
        }
        ret.add(path);
      }
      return ret;
    };

    // called on the root node of a chain to setup watchers on the specified
    // path.

    ChainNode.prototype.add = function add(path) {
      var paths = this._paths;
      paths[path] = (paths[path] || 0) + 1;

      var key = firstKey(path);
      var tail = path.slice(key.length + 1);

      this.chain(key, tail);
    };

    // called on the root node of a chain to teardown watcher on the specified
    // path

    ChainNode.prototype.remove = function remove(path) {
      var paths = this._paths;
      if (paths[path] > 0) {
        paths[path]--;
      }

      var key = firstKey(path);
      var tail = path.slice(key.length + 1);

      this.unchain(key, tail);
    };

    ChainNode.prototype.chain = function chain(key, path) {
      var chains = this._chains;
      var node = undefined;
      if (chains === undefined) {
        chains = this._chains = new _emberUtils.EmptyObject();
      } else {
        node = chains[key];
      }

      if (node === undefined) {
        node = chains[key] = new ChainNode(this, key, undefined);
      }

      node.count++; // count chains...

      // chain rest of path if there is one
      if (path) {
        key = firstKey(path);
        path = path.slice(key.length + 1);
        node.chain(key, path);
      }
    };

    ChainNode.prototype.unchain = function unchain(key, path) {
      var chains = this._chains;
      var node = chains[key];

      // unchain rest of path first...
      if (path && path.length > 1) {
        var nextKey = firstKey(path);
        var nextPath = path.slice(nextKey.length + 1);
        node.unchain(nextKey, nextPath);
      }

      // delete node if needed.
      node.count--;
      if (node.count <= 0) {
        chains[node._key] = undefined;
        node.destroy();
      }
    };

    ChainNode.prototype.notify = function notify(revalidate, affected) {
      if (revalidate && this._watching) {
        var parentValue = this._parent.value();

        if (parentValue !== this._object) {
          if (this._object) {
            removeChainWatcher(this._object, this._key, this);
          }

          if (isObject(parentValue)) {
            this._object = parentValue;
            addChainWatcher(parentValue, this._key, this);
          } else {
            this._object = undefined;
          }
        }
        this._value = undefined;
      }

      // then notify chains...
      var chains = this._chains;
      var node = undefined;
      if (chains) {
        for (var key in chains) {
          node = chains[key];
          if (node !== undefined) {
            node.notify(revalidate, affected);
          }
        }
      }

      if (affected && this._parent) {
        this._parent.populateAffected(this._key, 1, affected);
      }
    };

    ChainNode.prototype.populateAffected = function populateAffected(path, depth, affected) {
      if (this._key) {
        path = this._key + '.' + path;
      }

      if (this._parent) {
        this._parent.populateAffected(path, depth + 1, affected);
      } else {
        if (depth > 1) {
          affected.push(this.value(), path);
        }
      }
    };

    return ChainNode;
  })();

  function lazyGet(obj, key) {
    if (!isObject(obj)) {
      return;
    }

    var meta = _emberMetalMeta.peekMeta(obj);

    // check if object meant only to be a prototype
    if (meta && meta.proto === obj) {
      return;
    }

    // Use `get` if the return value is an EachProxy or an uncacheable value.
    if (isVolatile(obj[key])) {
      return _emberMetalProperty_get.get(obj, key);
      // Otherwise attempt to get the cached value of the computed property
    } else {
        var cache = meta.readableCache();
        if (cache) {
          return _emberMetalComputed.cacheFor.get(cache, key);
        }
      }
  }

  function finishChains(obj) {
    // We only create meta if we really have to
    var m = _emberMetalMeta.peekMeta(obj);
    if (m) {
      m = _emberMetalMeta.meta(obj);

      // finish any current chains node watchers that reference obj
      var chainWatchers = m.readableChainWatchers();
      if (chainWatchers) {
        chainWatchers.revalidateAll();
      }
      // ensure that if we have inherited any chains they have been
      // copied onto our own meta.
      if (m.readableChains()) {
        m.writableChains(_emberMetalWatch_path.makeChainNode);
      }
    }
  }

  exports.removeChainWatcher = removeChainWatcher;
  exports.ChainNode = ChainNode;
});
enifed('ember-metal/computed', ['exports', 'ember-utils', 'ember-metal/debug', 'ember-metal/property_set', 'ember-metal/meta', 'ember-metal/expand_properties', 'ember-metal/error', 'ember-metal/properties', 'ember-metal/property_events', 'ember-metal/dependent_keys'], function (exports, _emberUtils, _emberMetalDebug, _emberMetalProperty_set, _emberMetalMeta, _emberMetalExpand_properties, _emberMetalError, _emberMetalProperties, _emberMetalProperty_events, _emberMetalDependent_keys) {
  'use strict';

  exports.default = computed;

  /**
  @module ember
  @submodule ember-metal
  */

  var DEEP_EACH_REGEX = /\.@each\.[^.]+\./;

  /**
    A computed property transforms an object literal with object's accessor function(s) into a property.
  
    By default the function backing the computed property will only be called
    once and the result will be cached. You can specify various properties
    that your computed property depends on. This will force the cached
    result to be recomputed if the dependencies are modified.
  
    In the following example we declare a computed property - `fullName` - by calling
    `.Ember.computed()` with property dependencies (`firstName` and `lastName`) as leading arguments and getter accessor function. The `fullName` getter function
    will be called once (regardless of how many times it is accessed) as long
    as its dependencies have not changed. Once `firstName` or `lastName` are updated
    any future calls (or anything bound) to `fullName` will incorporate the new
    values.
  
    ```javascript
    let Person = Ember.Object.extend({
      // these will be supplied by `create`
      firstName: null,
      lastName: null,
  
      fullName: Ember.computed('firstName', 'lastName', function() {
        let firstName = this.get('firstName'),
            lastName  = this.get('lastName');
  
        return firstName + ' ' + lastName;
      })
    });
  
    let tom = Person.create({
      firstName: 'Tom',
      lastName: 'Dale'
    });
  
    tom.get('fullName') // 'Tom Dale'
    ```
  
    You can also define what Ember should do when setting a computed property by providing additional function (`set`) in hash argument.
    If you try to set a computed property, it will try to invoke setter accessor function with the key and
    value you want to set it to as arguments.
  
    ```javascript
    let Person = Ember.Object.extend({
      // these will be supplied by `create`
      firstName: null,
      lastName: null,
  
      fullName: Ember.computed('firstName', 'lastName', {
        get(key) {
          let firstName = this.get('firstName'),
              lastName  = this.get('lastName');
  
          return firstName + ' ' + lastName;
        },
        set(key, value) {
          let [firstName, lastName] = value.split(' ');
  
          this.set('firstName', firstName);
          this.set('lastName', lastName);
  
          return value;
        }
      })
    });
  
    let person = Person.create();
  
    person.set('fullName', 'Peter Wagenet');
    person.get('firstName'); // 'Peter'
    person.get('lastName');  // 'Wagenet'
    ```
  
    You can overwrite computed property with normal property (no longer computed), that won't change if dependencies change, if you set computed property and it won't have setter accessor function defined.
  
    You can also mark computed property as `.readOnly()` and block all attempts to set it.
  
    ```javascript
    let Person = Ember.Object.extend({
      // these will be supplied by `create`
      firstName: null,
      lastName: null,
  
      fullName: Ember.computed('firstName', 'lastName', {
        get(key) {
          let firstName = this.get('firstName');
          let lastName  = this.get('lastName');
  
          return firstName + ' ' + lastName;
        }
      }).readOnly()
    });
  
    let person = Person.create();
    person.set('fullName', 'Peter Wagenet'); // Uncaught Error: Cannot set read-only property "fullName" on object: <(...):emberXXX>
    ```
  
    Additional resources:
    - [New CP syntax RFC](https://github.com/emberjs/rfcs/blob/master/text/0011-improved-cp-syntax.md)
    - [New computed syntax explained in "Ember 1.12 released" ](http://emberjs.com/blog/2015/05/13/ember-1-12-released.html#toc_new-computed-syntax)
  
    @class ComputedProperty
    @namespace Ember
    @public
  */
  function ComputedProperty(config, opts) {
    this.isDescriptor = true;
    if (typeof config === 'function') {
      this._getter = config;
    } else {
      _emberMetalDebug.assert('Ember.computed expects a function or an object as last argument.', typeof config === 'object' && !Array.isArray(config));
      _emberMetalDebug.assert('Config object passed to an Ember.computed can only contain `get` or `set` keys.', (function () {
        var keys = Object.keys(config);
        for (var i = 0; i < keys.length; i++) {
          if (keys[i] !== 'get' && keys[i] !== 'set') {
            return false;
          }
        }
        return true;
      })());
      this._getter = config.get;
      this._setter = config.set;
    }
    _emberMetalDebug.assert('Computed properties must receive a getter or a setter, you passed none.', !!this._getter || !!this._setter);
    this._dependentKeys = undefined;
    this._suspended = undefined;
    this._meta = undefined;
    this._volatile = false;
    this._dependentKeys = opts && opts.dependentKeys;
    this._readOnly = false;
  }

  ComputedProperty.prototype = new _emberMetalProperties.Descriptor();
  ComputedProperty.prototype.constructor = ComputedProperty;

  var ComputedPropertyPrototype = ComputedProperty.prototype;

  /**
    Call on a computed property to set it into non-cached mode. When in this
    mode the computed property will not automatically cache the return value.
  
    It also does not automatically fire any change events. You must manually notify
    any changes if you want to observe this property.
  
    Dependency keys have no effect on volatile properties as they are for cache
    invalidation and notification when cached value is invalidated.
  
    ```javascript
    let outsideService = Ember.Object.extend({
      value: Ember.computed(function() {
        return OutsideService.getValue();
      }).volatile()
    }).create();
    ```
  
    @method volatile
    @return {Ember.ComputedProperty} this
    @chainable
    @public
  */
  ComputedPropertyPrototype.volatile = function () {
    this._volatile = true;
    return this;
  };

  /**
    Call on a computed property to set it into read-only mode. When in this
    mode the computed property will throw an error when set.
  
    ```javascript
    let Person = Ember.Object.extend({
      guid: Ember.computed(function() {
        return 'guid-guid-guid';
      }).readOnly()
    });
  
    let person = Person.create();
  
    person.set('guid', 'new-guid'); // will throw an exception
    ```
  
    @method readOnly
    @return {Ember.ComputedProperty} this
    @chainable
    @public
  */
  ComputedPropertyPrototype.readOnly = function () {
    this._readOnly = true;
    _emberMetalDebug.assert('Computed properties that define a setter using the new syntax cannot be read-only', !(this._readOnly && this._setter && this._setter !== this._getter));
    return this;
  };

  /**
    Sets the dependent keys on this computed property. Pass any number of
    arguments containing key paths that this computed property depends on.
  
    ```javascript
    let President = Ember.Object.extend({
      fullName: Ember.computed(function() {
        return this.get('firstName') + ' ' + this.get('lastName');
  
        // Tell Ember that this computed property depends on firstName
        // and lastName
      }).property('firstName', 'lastName')
    });
  
    let president = President.create({
      firstName: 'Barack',
      lastName: 'Obama'
    });
  
    president.get('fullName'); // 'Barack Obama'
    ```
  
    @method property
    @param {String} path* zero or more property paths
    @return {Ember.ComputedProperty} this
    @chainable
    @public
  */
  ComputedPropertyPrototype.property = function () {
    var args = [];

    function addArg(property) {
      _emberMetalDebug.warn('Dependent keys containing @each only work one level deep. ' + ('You used the key "' + property + '" which is invalid. ') + 'Please create an intermediary computed property.', DEEP_EACH_REGEX.test(property) === false, { id: 'ember-metal.computed-deep-each' });
      args.push(property);
    }

    for (var i = 0; i < arguments.length; i++) {
      _emberMetalExpand_properties.default(arguments[i], addArg);
    }

    this._dependentKeys = args;
    return this;
  };

  /**
    In some cases, you may want to annotate computed properties with additional
    metadata about how they function or what values they operate on. For example,
    computed property functions may close over variables that are then no longer
    available for introspection.
  
    You can pass a hash of these values to a computed property like this:
  
    ```
    person: Ember.computed(function() {
      let personId = this.get('personId');
      return App.Person.create({ id: personId });
    }).meta({ type: App.Person })
    ```
  
    The hash that you pass to the `meta()` function will be saved on the
    computed property descriptor under the `_meta` key. Ember runtime
    exposes a public API for retrieving these values from classes,
    via the `metaForProperty()` function.
  
    @method meta
    @param {Object} meta
    @chainable
    @public
  */
  ComputedPropertyPrototype.meta = function (meta) {
    if (arguments.length === 0) {
      return this._meta || {};
    } else {
      this._meta = meta;
      return this;
    }
  };

  // invalidate cache when CP key changes
  ComputedPropertyPrototype.didChange = function (obj, keyName) {
    // _suspended is set via a CP.set to ensure we don't clear
    // the cached value set by the setter
    if (this._volatile || this._suspended === obj) {
      return;
    }

    // don't create objects just to invalidate
    var meta = _emberMetalMeta.peekMeta(obj);
    if (!meta || meta.source !== obj) {
      return;
    }

    var cache = meta.readableCache();
    if (cache && cache[keyName] !== undefined) {
      cache[keyName] = undefined;
      _emberMetalDependent_keys.removeDependentKeys(this, obj, keyName, meta);
    }
  };

  ComputedPropertyPrototype.get = function (obj, keyName) {
    if (this._volatile) {
      return this._getter.call(obj, keyName);
    }

    var meta = _emberMetalMeta.meta(obj);
    var cache = meta.writableCache();

    var result = cache[keyName];
    if (result === _emberMetalMeta.UNDEFINED) {
      return undefined;
    } else if (result !== undefined) {
      return result;
    }

    var ret = this._getter.call(obj, keyName);
    if (ret === undefined) {
      cache[keyName] = _emberMetalMeta.UNDEFINED;
    } else {
      cache[keyName] = ret;
    }

    var chainWatchers = meta.readableChainWatchers();
    if (chainWatchers) {
      chainWatchers.revalidate(keyName);
    }
    _emberMetalDependent_keys.addDependentKeys(this, obj, keyName, meta);

    return ret;
  };

  ComputedPropertyPrototype.set = function computedPropertySetEntry(obj, keyName, value) {
    if (this._readOnly) {
      this._throwReadOnlyError(obj, keyName);
    }

    if (!this._setter) {
      return this.clobberSet(obj, keyName, value);
    }

    if (this._volatile) {
      return this.volatileSet(obj, keyName, value);
    }

    return this.setWithSuspend(obj, keyName, value);
  };

  ComputedPropertyPrototype._throwReadOnlyError = function computedPropertyThrowReadOnlyError(obj, keyName) {
    throw new _emberMetalError.default('Cannot set read-only property "' + keyName + '" on object: ' + _emberUtils.inspect(obj));
  };

  ComputedPropertyPrototype.clobberSet = function computedPropertyClobberSet(obj, keyName, value) {
    var cachedValue = cacheFor(obj, keyName);
    _emberMetalProperties.defineProperty(obj, keyName, null, cachedValue);
    _emberMetalProperty_set.set(obj, keyName, value);
    return value;
  };

  ComputedPropertyPrototype.volatileSet = function computedPropertyVolatileSet(obj, keyName, value) {
    return this._setter.call(obj, keyName, value);
  };

  ComputedPropertyPrototype.setWithSuspend = function computedPropertySetWithSuspend(obj, keyName, value) {
    var oldSuspended = this._suspended;
    this._suspended = obj;
    try {
      return this._set(obj, keyName, value);
    } finally {
      this._suspended = oldSuspended;
    }
  };

  ComputedPropertyPrototype._set = function computedPropertySet(obj, keyName, value) {
    // cache requires own meta
    var meta = _emberMetalMeta.meta(obj);
    // either there is a writable cache or we need one to update
    var cache = meta.writableCache();
    var hadCachedValue = false;
    var cachedValue = undefined;
    if (cache[keyName] !== undefined) {
      if (cache[keyName] !== _emberMetalMeta.UNDEFINED) {
        cachedValue = cache[keyName];
      }
      hadCachedValue = true;
    }

    var ret = this._setter.call(obj, keyName, value, cachedValue);

    // allows setter to return the same value that is cached already
    if (hadCachedValue && cachedValue === ret) {
      return ret;
    }

    _emberMetalProperty_events.propertyWillChange(obj, keyName);

    if (hadCachedValue) {
      cache[keyName] = undefined;
    }

    if (!hadCachedValue) {
      _emberMetalDependent_keys.addDependentKeys(this, obj, keyName, meta);
    }

    if (ret === undefined) {
      cache[keyName] = _emberMetalMeta.UNDEFINED;
    } else {
      cache[keyName] = ret;
    }

    _emberMetalProperty_events.propertyDidChange(obj, keyName);

    return ret;
  };

  /* called before property is overridden */
  ComputedPropertyPrototype.teardown = function (obj, keyName) {
    if (this._volatile) {
      return;
    }
    var meta = _emberMetalMeta.meta(obj);
    var cache = meta.readableCache();
    if (cache && cache[keyName] !== undefined) {
      _emberMetalDependent_keys.removeDependentKeys(this, obj, keyName, meta);
      cache[keyName] = undefined;
    }
  };

  /**
    This helper returns a new property descriptor that wraps the passed
    computed property function. You can use this helper to define properties
    with mixins or via `Ember.defineProperty()`.
  
    If you pass a function as an argument, it will be used as a getter. A computed
    property defined in this way might look like this:
  
    ```js
    let Person = Ember.Object.extend({
      init() {
        this._super(...arguments);
  
        this.firstName = 'Betty';
        this.lastName = 'Jones';
      },
  
      fullName: Ember.computed('firstName', 'lastName', function() {
        return `${this.get('firstName')} ${this.get('lastName')}`;
      })
    });
  
    let client = Person.create();
  
    client.get('fullName'); // 'Betty Jones'
  
    client.set('lastName', 'Fuller');
    client.get('fullName'); // 'Betty Fuller'
    ```
  
    You can pass a hash with two functions, `get` and `set`, as an
    argument to provide both a getter and setter:
  
    ```js
    let Person = Ember.Object.extend({
      init() {
        this._super(...arguments);
  
        this.firstName = 'Betty';
        this.lastName = 'Jones';
      },
  
      fullName: Ember.computed('firstName', 'lastName', {
        get(key) {
          return `${this.get('firstName')} ${this.get('lastName')}`;
        },
        set(key, value) {
          let [firstName, lastName] = value.split(/\s+/);
          this.setProperties({ firstName, lastName });
          return value;
        }
      })
    });
  
    let client = Person.create();
    client.get('firstName'); // 'Betty'
  
    client.set('fullName', 'Carroll Fuller');
    client.get('firstName'); // 'Carroll'
    ```
  
    The `set` function should accept two parameters, `key` and `value`. The value
    returned from `set` will be the new value of the property.
  
    _Note: This is the preferred way to define computed properties when writing third-party
    libraries that depend on or use Ember, since there is no guarantee that the user
    will have [prototype Extensions](http://emberjs.com/guides/configuring-ember/disabling-prototype-extensions/) enabled._
  
    The alternative syntax, with prototype extensions, might look like:
  
    ```js
    fullName: function() {
      return this.get('firstName') + ' ' + this.get('lastName');
    }.property('firstName', 'lastName')
    ```
  
    @class computed
    @namespace Ember
    @constructor
    @static
    @param {String} [dependentKeys*] Optional dependent keys that trigger this computed property.
    @param {Function} func The computed property function.
    @return {Ember.ComputedProperty} property descriptor instance
    @public
  */

  function computed(func) {
    var args = undefined;

    if (arguments.length > 1) {
      args = [].slice.call(arguments);
      func = args.pop();
    }

    var cp = new ComputedProperty(func);

    if (args) {
      cp.property.apply(cp, args);
    }

    return cp;
  }

  /**
    Returns the cached value for a property, if one exists.
    This can be useful for peeking at the value of a computed
    property that is generated lazily, without accidentally causing
    it to be created.
  
    @method cacheFor
    @for Ember
    @param {Object} obj the object whose property you want to check
    @param {String} key the name of the property whose cached value you want
      to return
    @return {Object} the cached value
    @public
  */
  function cacheFor(obj, key) {
    var meta = _emberMetalMeta.peekMeta(obj);
    var cache = meta && meta.source === obj && meta.readableCache();
    var ret = cache && cache[key];

    if (ret === _emberMetalMeta.UNDEFINED) {
      return undefined;
    }
    return ret;
  }

  cacheFor.set = function (cache, key, value) {
    if (value === undefined) {
      cache[key] = _emberMetalMeta.UNDEFINED;
    } else {
      cache[key] = value;
    }
  };

  cacheFor.get = function (cache, key) {
    var ret = cache[key];
    if (ret === _emberMetalMeta.UNDEFINED) {
      return undefined;
    }
    return ret;
  };

  cacheFor.remove = function (cache, key) {
    cache[key] = undefined;
  };

  exports.ComputedProperty = ComputedProperty;
  exports.computed = computed;
  exports.cacheFor = cacheFor;
});
enifed('ember-metal/core', ['exports', 'ember-environment'], function (exports, _emberEnvironment) {
  'use strict';

  /**
  @module ember
  @submodule ember-metal
  */

  /**
    This namespace contains all Ember methods and functions. Future versions of
    Ember may overwrite this namespace and therefore, you should avoid adding any
    new properties.
  
    At the heart of Ember is Ember-Runtime, a set of core functions that provide
    cross-platform compatibility and object property observing.  Ember-Runtime is
    small and performance-focused so you can use it alongside other
    cross-platform libraries such as jQuery. For more details, see
    [Ember-Runtime](http://emberjs.com/api/modules/ember-runtime.html).
  
    @class Ember
    @static
    @public
  */
  var Ember = typeof _emberEnvironment.context.imports.Ember === 'object' && _emberEnvironment.context.imports.Ember || {};

  // Make sure these are set whether Ember was already defined or not
  Ember.isNamespace = true;
  Ember.toString = function () {
    return 'Ember';
  };

  // ..........................................................
  // BOOTSTRAP
  //

  exports.default = Ember;
});
enifed("ember-metal/debug", ["exports"], function (exports) {
  "use strict";

  exports.getDebugFunction = getDebugFunction;
  exports.setDebugFunction = setDebugFunction;
  exports.assert = assert;
  exports.info = info;
  exports.warn = warn;
  exports.debug = debug;
  exports.deprecate = deprecate;
  exports.deprecateFunc = deprecateFunc;
  exports.runInDebug = runInDebug;
  exports.debugSeal = debugSeal;
  exports.debugFreeze = debugFreeze;
  var debugFunctions = {
    assert: function () {},
    info: function () {},
    warn: function () {},
    debug: function () {},
    deprecate: function () {},
    deprecateFunc: function () {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return args[args.length - 1];
    },
    runInDebug: function () {},
    debugSeal: function () {},
    debugFreeze: function () {}
  };

  exports.debugFunctions = debugFunctions;

  function getDebugFunction(name) {
    return debugFunctions[name];
  }

  function setDebugFunction(name, fn) {
    debugFunctions[name] = fn;
  }

  function assert() {
    return debugFunctions.assert.apply(undefined, arguments);
  }

  function info() {
    return debugFunctions.info.apply(undefined, arguments);
  }

  function warn() {
    return debugFunctions.warn.apply(undefined, arguments);
  }

  function debug() {
    return debugFunctions.debug.apply(undefined, arguments);
  }

  function deprecate() {
    return debugFunctions.deprecate.apply(undefined, arguments);
  }

  function deprecateFunc() {
    return debugFunctions.deprecateFunc.apply(undefined, arguments);
  }

  function runInDebug() {
    return debugFunctions.runInDebug.apply(undefined, arguments);
  }

  function debugSeal() {
    return debugFunctions.debugSeal.apply(undefined, arguments);
  }

  function debugFreeze() {
    return debugFunctions.debugFreeze.apply(undefined, arguments);
  }
});
enifed('ember-metal/dependent_keys', ['exports', 'ember-metal/watching'], function (exports, _emberMetalWatching) {
  'no use strict';
  // Remove "use strict"; from transpiled module until
  // https://bugs.webkit.org/show_bug.cgi?id=138038 is fixed

  exports.addDependentKeys = addDependentKeys;
  exports.removeDependentKeys = removeDependentKeys;

  /**
  @module ember
  @submodule ember-metal
  */

  // ..........................................................
  // DEPENDENT KEYS
  //

  function addDependentKeys(desc, obj, keyName, meta) {
    // the descriptor has a list of dependent keys, so
    // add all of its dependent keys.
    var idx = undefined,
        depKey = undefined;
    var depKeys = desc._dependentKeys;
    if (!depKeys) {
      return;
    }

    for (idx = 0; idx < depKeys.length; idx++) {
      depKey = depKeys[idx];
      // Increment the number of times depKey depends on keyName.
      meta.writeDeps(depKey, keyName, (meta.peekDeps(depKey, keyName) || 0) + 1);
      // Watch the depKey
      _emberMetalWatching.watch(obj, depKey, meta);
    }
  }

  function removeDependentKeys(desc, obj, keyName, meta) {
    // the descriptor has a list of dependent keys, so
    // remove all of its dependent keys.
    var depKeys = desc._dependentKeys;
    if (!depKeys) {
      return;
    }

    for (var idx = 0; idx < depKeys.length; idx++) {
      var depKey = depKeys[idx];
      // Decrement the number of times depKey depends on keyName.
      meta.writeDeps(depKey, keyName, (meta.peekDeps(depKey, keyName) || 0) - 1);
      // Unwatch the depKey
      _emberMetalWatching.unwatch(obj, depKey, meta);
    }
  }
});
enifed('ember-metal/deprecate_property', ['exports', 'ember-metal/debug', 'ember-metal/property_get', 'ember-metal/property_set'], function (exports, _emberMetalDebug, _emberMetalProperty_get, _emberMetalProperty_set) {
  /**
  @module ember
  @submodule ember-metal
  */

  'use strict';

  exports.deprecateProperty = deprecateProperty;

  /**
    Used internally to allow changing properties in a backwards compatible way, and print a helpful
    deprecation warning.
  
    @method deprecateProperty
    @param {Object} object The object to add the deprecated property to.
    @param {String} deprecatedKey The property to add (and print deprecation warnings upon accessing).
    @param {String} newKey The property that will be aliased.
    @private
    @since 1.7.0
  */

  function deprecateProperty(object, deprecatedKey, newKey, options) {
    function _deprecate() {
      _emberMetalDebug.deprecate('Usage of `' + deprecatedKey + '` is deprecated, use `' + newKey + '` instead.', false, options);
    }

    Object.defineProperty(object, deprecatedKey, {
      configurable: true,
      enumerable: false,
      set: function (value) {
        _deprecate();
        _emberMetalProperty_set.set(this, newKey, value);
      },
      get: function () {
        _deprecate();
        return _emberMetalProperty_get.get(this, newKey);
      }
    });
  }
});
enifed('ember-metal/descriptor', ['exports', 'ember-metal/properties'], function (exports, _emberMetalProperties) {
  'use strict';

  exports.default = descriptor;

  function descriptor(desc) {
    return new Descriptor(desc);
  }

  /**
    A wrapper for a native ES5 descriptor. In an ideal world, we wouldn't need
    this at all, however, the way we currently flatten/merge our mixins require
    a special value to denote a descriptor.
  
    @class Descriptor
    @private
  */

  var Descriptor = (function (_EmberDescriptor) {
    babelHelpers.inherits(Descriptor, _EmberDescriptor);

    function Descriptor(desc) {
      babelHelpers.classCallCheck(this, Descriptor);

      _EmberDescriptor.call(this);
      this.desc = desc;
    }

    Descriptor.prototype.setup = function setup(obj, key) {
      Object.defineProperty(obj, key, this.desc);
    };

    Descriptor.prototype.teardown = function teardown(obj, key) {};

    return Descriptor;
  })(_emberMetalProperties.Descriptor);
});
enifed("ember-metal/error", ["exports"], function (exports) {

  /**
    A subclass of the JavaScript Error object for use in Ember.
  
    @class Error
    @namespace Ember
    @extends Error
    @constructor
    @public
  */
  "use strict";

  var EmberError = (function (_Error) {
    babelHelpers.inherits(EmberError, _Error);

    function EmberError(message) {
      babelHelpers.classCallCheck(this, EmberError);

      _Error.call(this);

      if (!(this instanceof EmberError)) {
        return new EmberError(message);
      }

      var error = Error.call(this, message);

      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, EmberError);
      } else {
        this.stack = error.stack;
      }

      this.description = error.description;
      this.fileName = error.fileName;
      this.lineNumber = error.lineNumber;
      this.message = error.message;
      this.name = error.name;
      this.number = error.number;
      this.code = error.code;
    }

    return EmberError;
  })(Error);

  exports.default = EmberError;
});
enifed('ember-metal/error_handler', ['exports', 'ember-console', 'ember-metal/testing'], function (exports, _emberConsole, _emberMetalTesting) {
  'use strict';

  exports.getOnerror = getOnerror;
  exports.setOnerror = setOnerror;
  exports.dispatchError = dispatchError;
  exports.setDispatchOverride = setDispatchOverride;

  // To maintain stacktrace consistency across browsers
  var getStack = function (error) {
    var stack = error.stack;
    var message = error.message;

    if (stack && !stack.includes(message)) {
      stack = message + '\n' + stack;
    }

    return stack;
  };

  var onerror = undefined;
  // Ember.onerror getter

  function getOnerror() {
    return onerror;
  }

  // Ember.onerror setter

  function setOnerror(handler) {
    onerror = handler;
  }

  var dispatchOverride = undefined;
  // dispatch error

  function dispatchError(error) {
    if (dispatchOverride) {
      dispatchOverride(error);
    } else {
      defaultDispatch(error);
    }
  }

  // allows testing adapter to override dispatch

  function setDispatchOverride(handler) {
    dispatchOverride = handler;
  }

  function defaultDispatch(error) {
    if (_emberMetalTesting.isTesting()) {
      throw error;
    }
    if (onerror) {
      onerror(error);
    } else {
      _emberConsole.default.error(getStack(error));
    }
  }
});
enifed('ember-metal/events', ['exports', 'ember-utils', 'ember-metal/debug', 'ember-metal/meta', 'ember-metal/meta_listeners'], function (exports, _emberUtils, _emberMetalDebug, _emberMetalMeta, _emberMetalMeta_listeners) {
  'no use strict';
  // Remove "use strict"; from transpiled module until
  // https://bugs.webkit.org/show_bug.cgi?id=138038 is fixed

  /**
  @module ember
  @submodule ember-metal
  */
  exports.accumulateListeners = accumulateListeners;
  exports.addListener = addListener;
  exports.removeListener = removeListener;
  exports.suspendListener = suspendListener;
  exports.suspendListeners = suspendListeners;
  exports.watchedEvents = watchedEvents;
  exports.sendEvent = sendEvent;
  exports.hasListeners = hasListeners;
  exports.listenersFor = listenersFor;
  exports.on = on;

  /*
    The event system uses a series of nested hashes to store listeners on an
    object. When a listener is registered, or when an event arrives, these
    hashes are consulted to determine which target and action pair to invoke.
  
    The hashes are stored in the object's meta hash, and look like this:
  
        // Object's meta hash
        {
          listeners: {       // variable name: `listenerSet`
            "foo:changed": [ // variable name: `actions`
              target, method, flags
            ]
          }
        }
  
  */

  function indexOf(array, target, method) {
    var index = -1;
    // hashes are added to the end of the event array
    // so it makes sense to start searching at the end
    // of the array and search in reverse
    for (var i = array.length - 3; i >= 0; i -= 3) {
      if (target === array[i] && method === array[i + 1]) {
        index = i;
        break;
      }
    }
    return index;
  }

  function accumulateListeners(obj, eventName, otherActions) {
    var meta = _emberMetalMeta.peekMeta(obj);
    if (!meta) {
      return;
    }
    var actions = meta.matchingListeners(eventName);
    var newActions = [];

    for (var i = actions.length - 3; i >= 0; i -= 3) {
      var target = actions[i];
      var method = actions[i + 1];
      var flags = actions[i + 2];
      var actionIndex = indexOf(otherActions, target, method);

      if (actionIndex === -1) {
        otherActions.push(target, method, flags);
        newActions.push(target, method, flags);
      }
    }

    return newActions;
  }

  /**
    Add an event listener
  
    @method addListener
    @for Ember
    @param obj
    @param {String} eventName
    @param {Object|Function} target A target object or a function
    @param {Function|String} method A function or the name of a function to be called on `target`
    @param {Boolean} once A flag whether a function should only be called once
    @public
  */

  function addListener(obj, eventName, target, method, once) {
    _emberMetalDebug.assert('You must pass at least an object and event name to Ember.addListener', !!obj && !!eventName);

    _emberMetalDebug.deprecate('didInitAttrs called in ' + (obj && obj.toString && obj.toString()) + '.', eventName !== 'didInitAttrs', {
      id: 'ember-views.did-init-attrs',
      until: '3.0.0',
      url: 'http://emberjs.com/deprecations/v2.x#toc_ember-component-didinitattrs'
    });

    if (!method && 'function' === typeof target) {
      method = target;
      target = null;
    }

    var flags = 0;
    if (once) {
      flags |= _emberMetalMeta_listeners.ONCE;
    }

    _emberMetalMeta.meta(obj).addToListeners(eventName, target, method, flags);

    if ('function' === typeof obj.didAddListener) {
      obj.didAddListener(eventName, target, method);
    }
  }

  /**
    Remove an event listener
  
    Arguments should match those passed to `Ember.addListener`.
  
    @method removeListener
    @for Ember
    @param obj
    @param {String} eventName
    @param {Object|Function} target A target object or a function
    @param {Function|String} method A function or the name of a function to be called on `target`
    @public
  */

  function removeListener(obj, eventName, target, method) {
    _emberMetalDebug.assert('You must pass at least an object and event name to Ember.removeListener', !!obj && !!eventName);

    if (!method && 'function' === typeof target) {
      method = target;
      target = null;
    }

    _emberMetalMeta.meta(obj).removeFromListeners(eventName, target, method, function () {
      if ('function' === typeof obj.didRemoveListener) {
        obj.didRemoveListener.apply(obj, arguments);
      }
    });
  }

  /**
    Suspend listener during callback.
  
    This should only be used by the target of the event listener
    when it is taking an action that would cause the event, e.g.
    an object might suspend its property change listener while it is
    setting that property.
  
    @method suspendListener
    @for Ember
  
    @private
    @param obj
    @param {String} eventName
    @param {Object|Function} target A target object or a function
    @param {Function|String} method A function or the name of a function to be called on `target`
    @param {Function} callback
  */

  function suspendListener(obj, eventName, target, method, callback) {
    return suspendListeners(obj, [eventName], target, method, callback);
  }

  /**
    Suspends multiple listeners during a callback.
  
    @method suspendListeners
    @for Ember
  
    @private
    @param obj
    @param {Array} eventNames Array of event names
    @param {Object|Function} target A target object or a function
    @param {Function|String} method A function or the name of a function to be called on `target`
    @param {Function} callback
  */

  function suspendListeners(obj, eventNames, target, method, callback) {
    if (!method && 'function' === typeof target) {
      method = target;
      target = null;
    }
    return _emberMetalMeta.meta(obj).suspendListeners(eventNames, target, method, callback);
  }

  /**
    Return a list of currently watched events
  
    @private
    @method watchedEvents
    @for Ember
    @param obj
  */

  function watchedEvents(obj) {
    return _emberMetalMeta.meta(obj).watchedEvents();
  }

  /**
    Send an event. The execution of suspended listeners
    is skipped, and once listeners are removed. A listener without
    a target is executed on the passed object. If an array of actions
    is not passed, the actions stored on the passed object are invoked.
  
    @method sendEvent
    @for Ember
    @param obj
    @param {String} eventName
    @param {Array} params Optional parameters for each listener.
    @param {Array} actions Optional array of actions (listeners).
    @return true
    @public
  */

  function sendEvent(obj, eventName, params, actions) {
    if (!actions) {
      var meta = _emberMetalMeta.peekMeta(obj);
      actions = meta && meta.matchingListeners(eventName);
    }

    if (!actions || actions.length === 0) {
      return;
    }

    for (var i = actions.length - 3; i >= 0; i -= 3) {
      // looping in reverse for once listeners
      var target = actions[i];
      var method = actions[i + 1];
      var flags = actions[i + 2];

      if (!method) {
        continue;
      }
      if (flags & _emberMetalMeta_listeners.SUSPENDED) {
        continue;
      }
      if (flags & _emberMetalMeta_listeners.ONCE) {
        removeListener(obj, eventName, target, method);
      }
      if (!target) {
        target = obj;
      }
      if ('string' === typeof method) {
        if (params) {
          _emberUtils.applyStr(target, method, params);
        } else {
          target[method]();
        }
      } else {
        if (params) {
          method.apply(target, params);
        } else {
          method.call(target);
        }
      }
    }
    return true;
  }

  /**
    @private
    @method hasListeners
    @for Ember
    @param obj
    @param {String} eventName
  */

  function hasListeners(obj, eventName) {
    var meta = _emberMetalMeta.peekMeta(obj);
    if (!meta) {
      return false;
    }
    return meta.matchingListeners(eventName).length > 0;
  }

  /**
    @private
    @method listenersFor
    @for Ember
    @param obj
    @param {String} eventName
  */

  function listenersFor(obj, eventName) {
    var ret = [];
    var meta = _emberMetalMeta.peekMeta(obj);
    var actions = meta && meta.matchingListeners(eventName);

    if (!actions) {
      return ret;
    }

    for (var i = 0; i < actions.length; i += 3) {
      var target = actions[i];
      var method = actions[i + 1];
      ret.push([target, method]);
    }

    return ret;
  }

  /**
    Define a property as a function that should be executed when
    a specified event or events are triggered.
  
  
    ``` javascript
    let Job = Ember.Object.extend({
      logCompleted: Ember.on('completed', function() {
        console.log('Job completed!');
      })
    });
  
    let job = Job.create();
  
    Ember.sendEvent(job, 'completed'); // Logs 'Job completed!'
   ```
  
    @method on
    @for Ember
    @param {String} eventNames*
    @param {Function} func
    @return func
    @public
  */

  function on() {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var func = args.pop();
    var events = args;
    func.__ember_listens__ = events;
    return func;
  }
});
enifed('ember-metal/expand_properties', ['exports', 'ember-metal/debug'], function (exports, _emberMetalDebug) {
  'use strict';

  exports.default = expandProperties;

  /**
  @module ember
  @submodule ember-metal
  */

  var END_WITH_EACH_REGEX = /\.@each$/;

  /**
    Expands `pattern`, invoking `callback` for each expansion.
  
    The only pattern supported is brace-expansion, anything else will be passed
    once to `callback` directly.
  
    Example
  
    ```js
    function echo(arg){ console.log(arg); }
  
    Ember.expandProperties('foo.bar', echo);              //=> 'foo.bar'
    Ember.expandProperties('{foo,bar}', echo);            //=> 'foo', 'bar'
    Ember.expandProperties('foo.{bar,baz}', echo);        //=> 'foo.bar', 'foo.baz'
    Ember.expandProperties('{foo,bar}.baz', echo);        //=> 'foo.baz', 'bar.baz'
    Ember.expandProperties('foo.{bar,baz}.[]', echo)      //=> 'foo.bar.[]', 'foo.baz.[]'
    Ember.expandProperties('{foo,bar}.{spam,eggs}', echo) //=> 'foo.spam', 'foo.eggs', 'bar.spam', 'bar.eggs'
    Ember.expandProperties('{foo}.bar.{baz}')             //=> 'foo.bar.baz'
    ```
  
    @method expandProperties
    @for Ember
    @private
    @param {String} pattern The property pattern to expand.
    @param {Function} callback The callback to invoke.  It is invoked once per
    expansion, and is passed the expansion.
  */

  function expandProperties(pattern, callback) {
    _emberMetalDebug.assert('A computed property key must be a string', typeof pattern === 'string');
    _emberMetalDebug.assert('Brace expanded properties cannot contain spaces, e.g. "user.{firstName, lastName}" should be "user.{firstName,lastName}"', pattern.indexOf(' ') === -1);

    var unbalancedNestedError = 'Brace expanded properties have to be balanced and cannot be nested, pattern: ' + pattern;
    var properties = [pattern];

    // Iterating backward over the pattern makes dealing with indices easier.
    var bookmark = undefined;
    var inside = false;
    for (var i = pattern.length; i > 0; --i) {
      var current = pattern[i - 1];

      switch (current) {
        // Closing curly brace will be the first character of the brace expansion we encounter.
        // Bookmark its index so long as we're not already inside a brace expansion.
        case '}':
          if (!inside) {
            bookmark = i - 1;
            inside = true;
          } else {
            _emberMetalDebug.assert(unbalancedNestedError, false);
          }
          break;
        // Opening curly brace will be the last character of the brace expansion we encounter.
        // Apply the brace expansion so long as we've already seen a closing curly brace.
        case '{':
          if (inside) {
            var expansion = pattern.slice(i, bookmark).split(',');
            // Iterating backward allows us to push new properties w/out affecting our "cursor".
            for (var j = properties.length; j > 0; --j) {
              // Extract the unexpanded property from the array.
              var property = properties.splice(j - 1, 1)[0];
              // Iterate over the expansion, pushing the newly formed properties onto the array.
              for (var k = 0; k < expansion.length; ++k) {
                properties.push(property.slice(0, i - 1) + expansion[k] + property.slice(bookmark + 1));
              }
            }
            inside = false;
          } else {
            _emberMetalDebug.assert(unbalancedNestedError, false);
          }
          break;
      }
    }
    if (inside) {
      _emberMetalDebug.assert(unbalancedNestedError, false);
    }

    for (var i = 0; i < properties.length; i++) {
      callback(properties[i].replace(END_WITH_EACH_REGEX, '.[]'));
    }
  }
});
enifed('ember-metal/features', ['exports', 'ember-utils', 'ember-environment', 'ember/features'], function (exports, _emberUtils, _emberEnvironment, _emberFeatures) {
  'use strict';

  exports.default = isEnabled;

  /**
    The hash of enabled Canary features. Add to this, any canary features
    before creating your application.
  
    Alternatively (and recommended), you can also define `EmberENV.FEATURES`
    if you need to enable features flagged at runtime.
  
    @class FEATURES
    @namespace Ember
    @static
    @since 1.1.0
    @public
  */
  var FEATURES = _emberUtils.assign(_emberFeatures.default, _emberEnvironment.ENV.FEATURES);

  exports.FEATURES = FEATURES;
  /**
    Determine whether the specified `feature` is enabled. Used by Ember's
    build tools to exclude experimental features from beta/stable builds.
  
    You can define the following configuration options:
  
    * `EmberENV.ENABLE_OPTIONAL_FEATURES` - enable any features that have not been explicitly
      enabled/disabled.
  
    @method isEnabled
    @param {String} feature The feature to check
    @return {Boolean}
    @for Ember.FEATURES
    @since 1.1.0
    @public
  */

  function isEnabled(feature) {
    var featureValue = FEATURES[feature];

    if (featureValue === true || featureValue === false || featureValue === undefined) {
      return featureValue;
    } else if (_emberEnvironment.ENV.ENABLE_OPTIONAL_FEATURES) {
      return true;
    } else {
      return false;
    }
  }

  exports.DEFAULT_FEATURES = _emberFeatures.default;
});
enifed('ember-metal/get_properties', ['exports', 'ember-metal/property_get'], function (exports, _emberMetalProperty_get) {
  'use strict';

  exports.default = getProperties;

  /**
    To get multiple properties at once, call `Ember.getProperties`
    with an object followed by a list of strings or an array:
  
    ```javascript
    Ember.getProperties(record, 'firstName', 'lastName', 'zipCode');
    // { firstName: 'John', lastName: 'Doe', zipCode: '10011' }
    ```
  
    is equivalent to:
  
    ```javascript
    Ember.getProperties(record, ['firstName', 'lastName', 'zipCode']);
    // { firstName: 'John', lastName: 'Doe', zipCode: '10011' }
    ```
  
    @method getProperties
    @for Ember
    @param {Object} obj
    @param {String...|Array} list of keys to get
    @return {Object}
    @public
  */

  function getProperties(obj) {
    var ret = {};
    var propertyNames = arguments;
    var i = 1;

    if (arguments.length === 2 && Array.isArray(arguments[1])) {
      i = 0;
      propertyNames = arguments[1];
    }
    for (; i < propertyNames.length; i++) {
      ret[propertyNames[i]] = _emberMetalProperty_get.get(obj, propertyNames[i]);
    }
    return ret;
  }
});
enifed('ember-metal/index', ['exports', 'require', 'ember-metal/core', 'ember-metal/computed', 'ember-metal/alias', 'ember-metal/merge', 'ember-metal/debug', 'ember-metal/instrumentation', 'ember-metal/testing', 'ember-metal/error_handler', 'ember-metal/meta', 'ember-metal/error', 'ember-metal/cache', 'ember-metal/features', 'ember-metal/property_get', 'ember-metal/property_set', 'ember-metal/weak_map', 'ember-metal/events', 'ember-metal/is_none', 'ember-metal/is_empty', 'ember-metal/is_blank', 'ember-metal/is_present', 'ember-metal/run_loop', 'ember-metal/observer_set', 'ember-metal/property_events', 'ember-metal/properties', 'ember-metal/watch_key', 'ember-metal/chains', 'ember-metal/watch_path', 'ember-metal/watching', 'ember-metal/libraries', 'ember-metal/map', 'ember-metal/get_properties', 'ember-metal/set_properties', 'ember-metal/expand_properties', 'ember-metal/observer', 'ember-metal/mixin', 'ember-metal/binding', 'ember-metal/path_cache', 'ember-metal/injected_property', 'ember-metal/tags', 'ember-metal/replace', 'ember-metal/transaction', 'ember-metal/is_proxy', 'ember-metal/descriptor'], function (exports, _require, _emberMetalCore, _emberMetalComputed, _emberMetalAlias, _emberMetalMerge, _emberMetalDebug, _emberMetalInstrumentation, _emberMetalTesting, _emberMetalError_handler, _emberMetalMeta, _emberMetalError, _emberMetalCache, _emberMetalFeatures, _emberMetalProperty_get, _emberMetalProperty_set, _emberMetalWeak_map, _emberMetalEvents, _emberMetalIs_none, _emberMetalIs_empty, _emberMetalIs_blank, _emberMetalIs_present, _emberMetalRun_loop, _emberMetalObserver_set, _emberMetalProperty_events, _emberMetalProperties, _emberMetalWatch_key, _emberMetalChains, _emberMetalWatch_path, _emberMetalWatching, _emberMetalLibraries, _emberMetalMap, _emberMetalGet_properties, _emberMetalSet_properties, _emberMetalExpand_properties, _emberMetalObserver, _emberMetalMixin, _emberMetalBinding, _emberMetalPath_cache, _emberMetalInjected_property, _emberMetalTags, _emberMetalReplace, _emberMetalTransaction, _emberMetalIs_proxy, _emberMetalDescriptor) {
  /**
  @module ember
  @submodule ember-metal
  */

  'use strict';

  exports.default = _emberMetalCore.default;
  // reexports
  exports.computed = _emberMetalComputed.default;
  exports.cacheFor = _emberMetalComputed.cacheFor;
  exports.ComputedProperty = _emberMetalComputed.ComputedProperty;
  exports.alias = _emberMetalAlias.default;
  exports.merge = _emberMetalMerge.default;
  exports.assert = _emberMetalDebug.assert;
  exports.info = _emberMetalDebug.info;
  exports.warn = _emberMetalDebug.warn;
  exports.debug = _emberMetalDebug.debug;
  exports.deprecate = _emberMetalDebug.deprecate;
  exports.deprecateFunc = _emberMetalDebug.deprecateFunc;
  exports.runInDebug = _emberMetalDebug.runInDebug;
  exports.setDebugFunction = _emberMetalDebug.setDebugFunction;
  exports.getDebugFunction = _emberMetalDebug.getDebugFunction;
  exports.debugSeal = _emberMetalDebug.debugSeal;
  exports.debugFreeze = _emberMetalDebug.debugFreeze;
  exports.instrument = _emberMetalInstrumentation.instrument;
  exports.flaggedInstrument = _emberMetalInstrumentation.flaggedInstrument;
  exports._instrumentStart = _emberMetalInstrumentation._instrumentStart;
  exports.instrumentationReset = _emberMetalInstrumentation.reset;
  exports.instrumentationSubscribe = _emberMetalInstrumentation.subscribe;
  exports.instrumentationUnsubscribe = _emberMetalInstrumentation.unsubscribe;
  exports.isTesting = _emberMetalTesting.isTesting;
  exports.setTesting = _emberMetalTesting.setTesting;
  exports.getOnerror = _emberMetalError_handler.getOnerror;
  exports.setOnerror = _emberMetalError_handler.setOnerror;
  exports.dispatchError = _emberMetalError_handler.dispatchError;
  exports.setDispatchOverride = _emberMetalError_handler.setDispatchOverride;
  exports.META_DESC = _emberMetalMeta.META_DESC;
  exports.meta = _emberMetalMeta.meta;
  exports.peekMeta = _emberMetalMeta.peekMeta;
  exports.Error = _emberMetalError.default;
  exports.Cache = _emberMetalCache.default;
  exports.isFeatureEnabled = _emberMetalFeatures.default;
  exports.FEATURES = _emberMetalFeatures.FEATURES;
  exports.DEFAULT_FEATURES = _emberMetalFeatures.DEFAULT_FEATURES;
  exports._getPath = _emberMetalProperty_get._getPath;
  exports.get = _emberMetalProperty_get.get;
  exports.getWithDefault = _emberMetalProperty_get.getWithDefault;
  exports.set = _emberMetalProperty_set.set;
  exports.trySet = _emberMetalProperty_set.trySet;
  exports.WeakMap = _emberMetalWeak_map.default;
  exports.accumulateListeners = _emberMetalEvents.accumulateListeners;
  exports.addListener = _emberMetalEvents.addListener;
  exports.hasListeners = _emberMetalEvents.hasListeners;
  exports.listenersFor = _emberMetalEvents.listenersFor;
  exports.on = _emberMetalEvents.on;
  exports.removeListener = _emberMetalEvents.removeListener;
  exports.sendEvent = _emberMetalEvents.sendEvent;
  exports.suspendListener = _emberMetalEvents.suspendListener;
  exports.suspendListeners = _emberMetalEvents.suspendListeners;
  exports.watchedEvents = _emberMetalEvents.watchedEvents;
  exports.isNone = _emberMetalIs_none.default;
  exports.isEmpty = _emberMetalIs_empty.default;
  exports.isBlank = _emberMetalIs_blank.default;
  exports.isPresent = _emberMetalIs_present.default;
  exports.run = _emberMetalRun_loop.default;
  exports.ObserverSet = _emberMetalObserver_set.default;
  exports.beginPropertyChanges = _emberMetalProperty_events.beginPropertyChanges;
  exports.changeProperties = _emberMetalProperty_events.changeProperties;
  exports.endPropertyChanges = _emberMetalProperty_events.endPropertyChanges;
  exports.overrideChains = _emberMetalProperty_events.overrideChains;
  exports.propertyDidChange = _emberMetalProperty_events.propertyDidChange;
  exports.propertyWillChange = _emberMetalProperty_events.propertyWillChange;
  exports.PROPERTY_DID_CHANGE = _emberMetalProperty_events.PROPERTY_DID_CHANGE;
  exports.defineProperty = _emberMetalProperties.defineProperty;
  exports.Descriptor = _emberMetalProperties.Descriptor;
  exports.watchKey = _emberMetalWatch_key.watchKey;
  exports.unwatchKey = _emberMetalWatch_key.unwatchKey;
  exports.ChainNode = _emberMetalChains.ChainNode;
  exports.finishChains = _emberMetalChains.finishChains;
  exports.removeChainWatcher = _emberMetalChains.removeChainWatcher;
  exports.watchPath = _emberMetalWatch_path.watchPath;
  exports.unwatchPath = _emberMetalWatch_path.unwatchPath;
  exports.destroy = _emberMetalWatching.destroy;
  exports.isWatching = _emberMetalWatching.isWatching;
  exports.unwatch = _emberMetalWatching.unwatch;
  exports.watch = _emberMetalWatching.watch;
  exports.watcherCount = _emberMetalWatching.watcherCount;
  exports.libraries = _emberMetalLibraries.default;
  exports.Map = _emberMetalMap.Map;
  exports.MapWithDefault = _emberMetalMap.MapWithDefault;
  exports.OrderedSet = _emberMetalMap.OrderedSet;
  exports.getProperties = _emberMetalGet_properties.default;
  exports.setProperties = _emberMetalSet_properties.default;
  exports.expandProperties = _emberMetalExpand_properties.default;
  exports._suspendObserver = _emberMetalObserver._suspendObserver;
  exports._suspendObservers = _emberMetalObserver._suspendObservers;
  exports.addObserver = _emberMetalObserver.addObserver;
  exports.observersFor = _emberMetalObserver.observersFor;
  exports.removeObserver = _emberMetalObserver.removeObserver;
  exports._addBeforeObserver = _emberMetalObserver._addBeforeObserver;
  exports._removeBeforeObserver = _emberMetalObserver._removeBeforeObserver;
  exports.Mixin = _emberMetalMixin.Mixin;
  exports.aliasMethod = _emberMetalMixin.aliasMethod;
  exports._immediateObserver = _emberMetalMixin._immediateObserver;
  exports._beforeObserver = _emberMetalMixin._beforeObserver;
  exports.mixin = _emberMetalMixin.mixin;
  exports.observer = _emberMetalMixin.observer;
  exports.required = _emberMetalMixin.required;
  exports.REQUIRED = _emberMetalMixin.REQUIRED;
  exports.hasUnprocessedMixins = _emberMetalMixin.hasUnprocessedMixins;
  exports.clearUnprocessedMixins = _emberMetalMixin.clearUnprocessedMixins;
  exports.detectBinding = _emberMetalMixin.detectBinding;
  exports.Binding = _emberMetalBinding.Binding;
  exports.bind = _emberMetalBinding.bind;
  exports.isGlobalPath = _emberMetalPath_cache.isGlobalPath;
  exports.InjectedProperty = _emberMetalInjected_property.default;
  exports.setHasViews = _emberMetalTags.setHasViews;
  exports.tagForProperty = _emberMetalTags.tagForProperty;
  exports.tagFor = _emberMetalTags.tagFor;
  exports.markObjectAsDirty = _emberMetalTags.markObjectAsDirty;
  exports.replace = _emberMetalReplace.default;
  exports.runInTransaction = _emberMetalTransaction.default;
  exports.didRender = _emberMetalTransaction.didRender;
  exports.assertNotRendered = _emberMetalTransaction.assertNotRendered;
  exports.isProxy = _emberMetalIs_proxy.isProxy;
  exports.descriptor = _emberMetalDescriptor.default;

  // TODO: this needs to be deleted once we refactor the build tooling
  // do this for side-effects of updating Ember.assert, warn, etc when
  // ember-debug is present
  // This needs to be called before any deprecateFunc

  if (_require.has('ember-debug')) {
    _require.default('ember-debug');
  }
});
enifed('ember-metal/injected_property', ['exports', 'ember-utils', 'ember-metal/debug', 'ember-metal/computed', 'ember-metal/alias', 'ember-metal/properties'], function (exports, _emberUtils, _emberMetalDebug, _emberMetalComputed, _emberMetalAlias, _emberMetalProperties) {
  'use strict';

  exports.default = InjectedProperty;

  /**
    Read-only property that returns the result of a container lookup.
  
    @class InjectedProperty
    @namespace Ember
    @constructor
    @param {String} type The container type the property will lookup
    @param {String} name (optional) The name the property will lookup, defaults
           to the property's name
    @private
  */

  function InjectedProperty(type, name) {
    this.type = type;
    this.name = name;

    this._super$Constructor(injectedPropertyGet);
    AliasedPropertyPrototype.oneWay.call(this);
  }

  function injectedPropertyGet(keyName) {
    var desc = this[keyName];
    var owner = _emberUtils.getOwner(this) || this.container; // fallback to `container` for backwards compat

    _emberMetalDebug.assert('InjectedProperties should be defined with the Ember.inject computed property macros.', desc && desc.isDescriptor && desc.type);
    _emberMetalDebug.assert('Attempting to lookup an injected property on an object without a container, ensure that the object was instantiated via a container.', owner);

    return owner.lookup(desc.type + ':' + (desc.name || keyName));
  }

  InjectedProperty.prototype = Object.create(_emberMetalProperties.Descriptor.prototype);

  var InjectedPropertyPrototype = InjectedProperty.prototype;
  var ComputedPropertyPrototype = _emberMetalComputed.ComputedProperty.prototype;
  var AliasedPropertyPrototype = _emberMetalAlias.AliasedProperty.prototype;

  InjectedPropertyPrototype._super$Constructor = _emberMetalComputed.ComputedProperty;

  InjectedPropertyPrototype.get = ComputedPropertyPrototype.get;
  InjectedPropertyPrototype.readOnly = ComputedPropertyPrototype.readOnly;
  InjectedPropertyPrototype.teardown = ComputedPropertyPrototype.teardown;
});
enifed('ember-metal/instrumentation', ['exports', 'ember-environment', 'ember-metal/features'], function (exports, _emberEnvironment, _emberMetalFeatures) {
  /* eslint no-console:off */
  /* global console */

  'use strict';

  exports.instrument = instrument;
  exports._instrumentStart = _instrumentStart;
  exports.subscribe = subscribe;
  exports.unsubscribe = unsubscribe;
  exports.reset = reset;

  /**
    The purpose of the Ember Instrumentation module is
    to provide efficient, general-purpose instrumentation
    for Ember.
  
    Subscribe to a listener by using `Ember.subscribe`:
  
    ```javascript
    Ember.subscribe("render", {
      before(name, timestamp, payload) {
  
      },
  
      after(name, timestamp, payload) {
  
      }
    });
    ```
  
    If you return a value from the `before` callback, that same
    value will be passed as a fourth parameter to the `after`
    callback.
  
    Instrument a block of code by using `Ember.instrument`:
  
    ```javascript
    Ember.instrument("render.handlebars", payload, function() {
      // rendering logic
    }, binding);
    ```
  
    Event names passed to `Ember.instrument` are namespaced
    by periods, from more general to more specific. Subscribers
    can listen for events by whatever level of granularity they
    are interested in.
  
    In the above example, the event is `render.handlebars`,
    and the subscriber listened for all events beginning with
    `render`. It would receive callbacks for events named
    `render`, `render.handlebars`, `render.container`, or
    even `render.handlebars.layout`.
  
    @class Instrumentation
    @namespace Ember
    @static
    @private
  */
  var subscribers = [];
  exports.subscribers = subscribers;
  var cache = {};

  function populateListeners(name) {
    var listeners = [];
    var subscriber = undefined;

    for (var i = 0; i < subscribers.length; i++) {
      subscriber = subscribers[i];
      if (subscriber.regex.test(name)) {
        listeners.push(subscriber.object);
      }
    }

    cache[name] = listeners;
    return listeners;
  }

  var time = (function () {
    var perf = 'undefined' !== typeof window ? window.performance || {} : {};
    var fn = perf.now || perf.mozNow || perf.webkitNow || perf.msNow || perf.oNow;
    // fn.bind will be available in all the browsers that support the advanced window.performance... ;-)
    return fn ? fn.bind(perf) : function () {
      return +new Date();
    };
  })();

  /**
    Notifies event's subscribers, calls `before` and `after` hooks.
  
    @method instrument
    @namespace Ember.Instrumentation
  
    @param {String} [name] Namespaced event name.
    @param {Object} _payload
    @param {Function} callback Function that you're instrumenting.
    @param {Object} binding Context that instrument function is called with.
    @private
  */

  function instrument(name, _payload, callback, binding) {
    if (arguments.length <= 3 && typeof _payload === 'function') {
      binding = callback;
      callback = _payload;
      _payload = undefined;
    }
    if (subscribers.length === 0) {
      return callback.call(binding);
    }
    var payload = _payload || {};
    var finalizer = _instrumentStart(name, function () {
      return payload;
    });

    if (finalizer) {
      return withFinalizer(callback, finalizer, payload, binding);
    } else {
      return callback.call(binding);
    }
  }

  var flaggedInstrument = undefined;
  if (_emberMetalFeatures.default('ember-improved-instrumentation')) {
    exports.flaggedInstrument = flaggedInstrument = instrument;
  } else {
    exports.flaggedInstrument = flaggedInstrument = function (name, payload, callback) {
      return callback();
    };
  }
  exports.flaggedInstrument = flaggedInstrument;

  function withFinalizer(callback, finalizer, payload, binding) {
    var result = undefined;
    try {
      result = callback.call(binding);
    } catch (e) {
      payload.exception = e;
      result = payload;
    } finally {
      finalizer();
    }
    return result;
  }

  function NOOP() {}

  // private for now

  function _instrumentStart(name, _payload, _payloadParam) {
    if (subscribers.length === 0) {
      return NOOP;
    }

    var listeners = cache[name];

    if (!listeners) {
      listeners = populateListeners(name);
    }

    if (listeners.length === 0) {
      return NOOP;
    }

    var payload = _payload(_payloadParam);

    var STRUCTURED_PROFILE = _emberEnvironment.ENV.STRUCTURED_PROFILE;
    var timeName = undefined;
    if (STRUCTURED_PROFILE) {
      timeName = name + ': ' + payload.object;
      console.time(timeName);
    }

    var beforeValues = new Array(listeners.length);
    var i = undefined,
        listener = undefined;
    var timestamp = time();
    for (i = 0; i < listeners.length; i++) {
      listener = listeners[i];
      beforeValues[i] = listener.before(name, timestamp, payload);
    }

    return function _instrumentEnd() {
      var i = undefined,
          listener = undefined;
      var timestamp = time();
      for (i = 0; i < listeners.length; i++) {
        listener = listeners[i];
        if (typeof listener.after === 'function') {
          listener.after(name, timestamp, payload, beforeValues[i]);
        }
      }

      if (STRUCTURED_PROFILE) {
        console.timeEnd(timeName);
      }
    };
  }

  /**
    Subscribes to a particular event or instrumented block of code.
  
    @method subscribe
    @namespace Ember.Instrumentation
  
    @param {String} [pattern] Namespaced event name.
    @param {Object} [object] Before and After hooks.
  
    @return {Subscriber}
    @private
  */

  function subscribe(pattern, object) {
    var paths = pattern.split('.');
    var path = undefined;
    var regex = [];

    for (var i = 0; i < paths.length; i++) {
      path = paths[i];
      if (path === '*') {
        regex.push('[^\\.]*');
      } else {
        regex.push(path);
      }
    }

    regex = regex.join('\\.');
    regex = regex + '(\\..*)?';

    var subscriber = {
      pattern: pattern,
      regex: new RegExp('^' + regex + '$'),
      object: object
    };

    subscribers.push(subscriber);
    cache = {};

    return subscriber;
  }

  /**
    Unsubscribes from a particular event or instrumented block of code.
  
    @method unsubscribe
    @namespace Ember.Instrumentation
  
    @param {Object} [subscriber]
    @private
  */

  function unsubscribe(subscriber) {
    var index = undefined;

    for (var i = 0; i < subscribers.length; i++) {
      if (subscribers[i] === subscriber) {
        index = i;
      }
    }

    subscribers.splice(index, 1);
    cache = {};
  }

  /**
    Resets `Ember.Instrumentation` by flushing list of subscribers.
  
    @method reset
    @namespace Ember.Instrumentation
    @private
  */

  function reset() {
    subscribers.length = 0;
    cache = {};
  }
});
enifed('ember-metal/is_blank', ['exports', 'ember-metal/is_empty'], function (exports, _emberMetalIs_empty) {
  'use strict';

  exports.default = isBlank;

  /**
    A value is blank if it is empty or a whitespace string.
  
    ```javascript
    Ember.isBlank();                // true
    Ember.isBlank(null);            // true
    Ember.isBlank(undefined);       // true
    Ember.isBlank('');              // true
    Ember.isBlank([]);              // true
    Ember.isBlank('\n\t');          // true
    Ember.isBlank('  ');            // true
    Ember.isBlank({});              // false
    Ember.isBlank('\n\t Hello');    // false
    Ember.isBlank('Hello world');   // false
    Ember.isBlank([1,2,3]);         // false
    ```
  
    @method isBlank
    @for Ember
    @param {Object} obj Value to test
    @return {Boolean}
    @since 1.5.0
    @public
  */

  function isBlank(obj) {
    return _emberMetalIs_empty.default(obj) || typeof obj === 'string' && obj.match(/\S/) === null;
  }
});
enifed('ember-metal/is_empty', ['exports', 'ember-metal/property_get', 'ember-metal/is_none'], function (exports, _emberMetalProperty_get, _emberMetalIs_none) {
  'use strict';

  exports.default = isEmpty;

  /**
    Verifies that a value is `null` or an empty string, empty array,
    or empty function.
  
    Constrains the rules on `Ember.isNone` by returning true for empty
    string and empty arrays.
  
    ```javascript
    Ember.isEmpty();                // true
    Ember.isEmpty(null);            // true
    Ember.isEmpty(undefined);       // true
    Ember.isEmpty('');              // true
    Ember.isEmpty([]);              // true
    Ember.isEmpty({});              // false
    Ember.isEmpty('Adam Hawkins');  // false
    Ember.isEmpty([0,1,2]);         // false
    Ember.isEmpty('\n\t');          // false
    Ember.isEmpty('  ');            // false
    ```
  
    @method isEmpty
    @for Ember
    @param {Object} obj Value to test
    @return {Boolean}
    @public
  */

  function isEmpty(obj) {
    var none = _emberMetalIs_none.default(obj);
    if (none) {
      return none;
    }

    if (typeof obj.size === 'number') {
      return !obj.size;
    }

    var objectType = typeof obj;

    if (objectType === 'object') {
      var size = _emberMetalProperty_get.get(obj, 'size');
      if (typeof size === 'number') {
        return !size;
      }
    }

    if (typeof obj.length === 'number' && objectType !== 'function') {
      return !obj.length;
    }

    if (objectType === 'object') {
      var _length = _emberMetalProperty_get.get(obj, 'length');
      if (typeof _length === 'number') {
        return !_length;
      }
    }

    return false;
  }
});
enifed("ember-metal/is_none", ["exports"], function (exports) {
  /**
    Returns true if the passed value is null or undefined. This avoids errors
    from JSLint complaining about use of ==, which can be technically
    confusing.
  
    ```javascript
    Ember.isNone();              // true
    Ember.isNone(null);          // true
    Ember.isNone(undefined);     // true
    Ember.isNone('');            // false
    Ember.isNone([]);            // false
    Ember.isNone(function() {}); // false
    ```
  
    @method isNone
    @for Ember
    @param {Object} obj Value to test
    @return {Boolean}
    @public
  */
  "use strict";

  exports.default = isNone;

  function isNone(obj) {
    return obj === null || obj === undefined;
  }
});
enifed('ember-metal/is_present', ['exports', 'ember-metal/is_blank'], function (exports, _emberMetalIs_blank) {
  'use strict';

  exports.default = isPresent;

  /**
    A value is present if it not `isBlank`.
  
    ```javascript
    Ember.isPresent();                // false
    Ember.isPresent(null);            // false
    Ember.isPresent(undefined);       // false
    Ember.isPresent('');              // false
    Ember.isPresent('  ');            // false
    Ember.isPresent('\n\t');          // false
    Ember.isPresent([]);              // false
    Ember.isPresent({ length: 0 })    // false
    Ember.isPresent(false);           // true
    Ember.isPresent(true);            // true
    Ember.isPresent('string');        // true
    Ember.isPresent(0);               // true
    Ember.isPresent(function() {})    // true
    Ember.isPresent({});              // true
    Ember.isPresent(false);           // true
    Ember.isPresent('\n\t Hello');    // true
    Ember.isPresent([1,2,3]);         // true
    ```
  
    @method isPresent
    @for Ember
    @param {Object} obj Value to test
    @return {Boolean}
    @since 1.8.0
    @public
  */

  function isPresent(obj) {
    return !_emberMetalIs_blank.default(obj);
  }
});
enifed('ember-metal/is_proxy', ['exports', 'ember-metal/meta'], function (exports, _emberMetalMeta) {
  'use strict';

  exports.isProxy = isProxy;

  function isProxy(value) {
    if (typeof value === 'object' && value) {
      var meta = _emberMetalMeta.peekMeta(value);
      return meta && meta.isProxy();
    }

    return false;
  }
});
enifed('ember-metal/libraries', ['exports', 'ember-metal/debug', 'ember-metal/features'], function (exports, _emberMetalDebug, _emberMetalFeatures) {
  'use strict';

  /**
    Helper class that allows you to register your library with Ember.
  
    Singleton created at `Ember.libraries`.
  
    @class Libraries
    @constructor
    @private
  */

  var Libraries = (function () {
    function Libraries() {
      babelHelpers.classCallCheck(this, Libraries);

      this._registry = [];
      this._coreLibIndex = 0;
    }

    Libraries.prototype.isRegistered = function isRegistered(name) {
      return !!this._getLibraryByName(name);
    };

    return Libraries;
  })();

  exports.Libraries = Libraries;

  Libraries.prototype = {
    constructor: Libraries,

    _getLibraryByName: function (name) {
      var libs = this._registry;
      var count = libs.length;

      for (var i = 0; i < count; i++) {
        if (libs[i].name === name) {
          return libs[i];
        }
      }
    },

    register: function (name, version, isCoreLibrary) {
      var index = this._registry.length;

      if (!this._getLibraryByName(name)) {
        if (isCoreLibrary) {
          index = this._coreLibIndex++;
        }
        this._registry.splice(index, 0, { name: name, version: version });
      } else {
        _emberMetalDebug.warn('Library "' + name + '" is already registered with Ember.', false, { id: 'ember-metal.libraries-register' });
      }
    },

    registerCoreLibrary: function (name, version) {
      this.register(name, version, true);
    },

    deRegister: function (name) {
      var lib = this._getLibraryByName(name);
      var index = undefined;

      if (lib) {
        index = this._registry.indexOf(lib);
        this._registry.splice(index, 1);
      }
    }
  };

  if (_emberMetalFeatures.default('ember-libraries-isregistered')) {
    Libraries.prototype.isRegistered = function (name) {
      return !!this._getLibraryByName(name);
    };
  }

  exports.default = new Libraries();
});
enifed('ember-metal/map', ['exports', 'ember-utils'], function (exports, _emberUtils) {
  /**
  @module ember
  @submodule ember-metal
  */

  /*
    JavaScript (before ES6) does not have a Map implementation. Objects,
    which are often used as dictionaries, may only have Strings as keys.
  
    Because Ember has a way to get a unique identifier for every object
    via `Ember.guidFor`, we can implement a performant Map with arbitrary
    keys. Because it is commonly used in low-level bookkeeping, Map is
    implemented as a pure JavaScript object for performance.
  
    This implementation follows the current iteration of the ES6 proposal for
    maps (http://wiki.ecmascript.org/doku.php?id=harmony:simple_maps_and_sets),
    with one exception:  as we do not have the luxury of in-VM iteration, we implement a
    forEach method for iteration.
  
    Map is mocked out to look like an Ember object, so you can do
    `Ember.Map.create()` for symmetry with other Ember classes.
  */
  'use strict';

  function missingFunction(fn) {
    throw new TypeError(Object.prototype.toString.call(fn) + ' is not a function');
  }

  function missingNew(name) {
    throw new TypeError('Constructor ' + name + ' requires \'new\'');
  }

  function copyNull(obj) {
    var output = new _emberUtils.EmptyObject();

    for (var prop in obj) {
      // hasOwnPropery is not needed because obj is new EmptyObject();
      output[prop] = obj[prop];
    }

    return output;
  }

  function copyMap(original, newObject) {
    var keys = original._keys.copy();
    var values = copyNull(original._values);

    newObject._keys = keys;
    newObject._values = values;
    newObject.size = original.size;

    return newObject;
  }

  /**
    This class is used internally by Ember and Ember Data.
    Please do not use it at this time. We plan to clean it up
    and add many tests soon.
  
    @class OrderedSet
    @namespace Ember
    @constructor
    @private
  */
  function OrderedSet() {
    if (this instanceof OrderedSet) {
      this.clear();
      this._silenceRemoveDeprecation = false;
    } else {
      missingNew('OrderedSet');
    }
  }

  /**
    @method create
    @static
    @return {Ember.OrderedSet}
    @private
  */
  OrderedSet.create = function () {
    var Constructor = this;

    return new Constructor();
  };

  OrderedSet.prototype = {
    constructor: OrderedSet,
    /**
      @method clear
      @private
    */
    clear: function () {
      this.presenceSet = new _emberUtils.EmptyObject();
      this.list = [];
      this.size = 0;
    },

    /**
      @method add
      @param obj
      @param guid (optional, and for internal use)
      @return {Ember.OrderedSet}
      @private
    */
    add: function (obj, _guid) {
      var guid = _guid || _emberUtils.guidFor(obj);
      var presenceSet = this.presenceSet;
      var list = this.list;

      if (presenceSet[guid] !== true) {
        presenceSet[guid] = true;
        this.size = list.push(obj);
      }

      return this;
    },

    /**
      @since 1.8.0
      @method delete
      @param obj
      @param _guid (optional and for internal use only)
      @return {Boolean}
      @private
    */
    delete: function (obj, _guid) {
      var guid = _guid || _emberUtils.guidFor(obj);
      var presenceSet = this.presenceSet;
      var list = this.list;

      if (presenceSet[guid] === true) {
        delete presenceSet[guid];
        var index = list.indexOf(obj);
        if (index > -1) {
          list.splice(index, 1);
        }
        this.size = list.length;
        return true;
      } else {
        return false;
      }
    },

    /**
      @method isEmpty
      @return {Boolean}
      @private
    */
    isEmpty: function () {
      return this.size === 0;
    },

    /**
      @method has
      @param obj
      @return {Boolean}
      @private
    */
    has: function (obj) {
      if (this.size === 0) {
        return false;
      }

      var guid = _emberUtils.guidFor(obj);
      var presenceSet = this.presenceSet;

      return presenceSet[guid] === true;
    },

    /**
      @method forEach
      @param {Function} fn
      @param self
      @private
    */
    forEach: function (fn /*, ...thisArg*/) {
      if (typeof fn !== 'function') {
        missingFunction(fn);
      }

      if (this.size === 0) {
        return;
      }

      var list = this.list;

      if (arguments.length === 2) {
        for (var i = 0; i < list.length; i++) {
          fn.call(arguments[1], list[i]);
        }
      } else {
        for (var i = 0; i < list.length; i++) {
          fn(list[i]);
        }
      }
    },

    /**
      @method toArray
      @return {Array}
      @private
    */
    toArray: function () {
      return this.list.slice();
    },

    /**
      @method copy
      @return {Ember.OrderedSet}
      @private
    */
    copy: function () {
      var Constructor = this.constructor;
      var set = new Constructor();

      set._silenceRemoveDeprecation = this._silenceRemoveDeprecation;
      set.presenceSet = copyNull(this.presenceSet);
      set.list = this.toArray();
      set.size = this.size;

      return set;
    }
  };

  /**
    A Map stores values indexed by keys. Unlike JavaScript's
    default Objects, the keys of a Map can be any JavaScript
    object.
  
    Internally, a Map has two data structures:
  
    1. `keys`: an OrderedSet of all of the existing keys
    2. `values`: a JavaScript Object indexed by the `Ember.guidFor(key)`
  
    When a key/value pair is added for the first time, we
    add the key to the `keys` OrderedSet, and create or
    replace an entry in `values`. When an entry is deleted,
    we delete its entry in `keys` and `values`.
  
    @class Map
    @namespace Ember
    @private
    @constructor
  */
  function Map() {
    if (this instanceof Map) {
      this._keys = OrderedSet.create();
      this._keys._silenceRemoveDeprecation = true;
      this._values = new _emberUtils.EmptyObject();
      this.size = 0;
    } else {
      missingNew('Map');
    }
  }

  /**
    @method create
    @static
    @private
  */
  Map.create = function () {
    var Constructor = this;
    return new Constructor();
  };

  Map.prototype = {
    constructor: Map,

    /**
      This property will change as the number of objects in the map changes.
       @since 1.8.0
      @property size
      @type number
      @default 0
      @private
    */
    size: 0,

    /**
      Retrieve the value associated with a given key.
       @method get
      @param {*} key
      @return {*} the value associated with the key, or `undefined`
      @private
    */
    get: function (key) {
      if (this.size === 0) {
        return;
      }

      var values = this._values;
      var guid = _emberUtils.guidFor(key);

      return values[guid];
    },

    /**
      Adds a value to the map. If a value for the given key has already been
      provided, the new value will replace the old value.
       @method set
      @param {*} key
      @param {*} value
      @return {Ember.Map}
      @private
    */
    set: function (key, value) {
      var keys = this._keys;
      var values = this._values;
      var guid = _emberUtils.guidFor(key);

      // ensure we don't store -0
      var k = key === -0 ? 0 : key;

      keys.add(k, guid);

      values[guid] = value;

      this.size = keys.size;

      return this;
    },

    /**
      Removes a value from the map for an associated key.
       @since 1.8.0
      @method delete
      @param {*} key
      @return {Boolean} true if an item was removed, false otherwise
      @private
    */
    delete: function (key) {
      if (this.size === 0) {
        return false;
      }
      // don't use ES6 "delete" because it will be annoying
      // to use in browsers that are not ES6 friendly;
      var keys = this._keys;
      var values = this._values;
      var guid = _emberUtils.guidFor(key);

      if (keys.delete(key, guid)) {
        delete values[guid];
        this.size = keys.size;
        return true;
      } else {
        return false;
      }
    },

    /**
      Check whether a key is present.
       @method has
      @param {*} key
      @return {Boolean} true if the item was present, false otherwise
      @private
    */
    has: function (key) {
      return this._keys.has(key);
    },

    /**
      Iterate over all the keys and values. Calls the function once
      for each key, passing in value, key, and the map being iterated over,
      in that order.
       The keys are guaranteed to be iterated over in insertion order.
       @method forEach
      @param {Function} callback
      @param {*} self if passed, the `this` value inside the
        callback. By default, `this` is the map.
      @private
    */
    forEach: function (callback /*, ...thisArg*/) {
      if (typeof callback !== 'function') {
        missingFunction(callback);
      }

      if (this.size === 0) {
        return;
      }

      var map = this;
      var cb = undefined,
          thisArg = undefined;

      if (arguments.length === 2) {
        thisArg = arguments[1];
        cb = function (key) {
          return callback.call(thisArg, map.get(key), key, map);
        };
      } else {
        cb = function (key) {
          return callback(map.get(key), key, map);
        };
      }

      this._keys.forEach(cb);
    },

    /**
      @method clear
      @private
    */
    clear: function () {
      this._keys.clear();
      this._values = new _emberUtils.EmptyObject();
      this.size = 0;
    },

    /**
      @method copy
      @return {Ember.Map}
      @private
    */
    copy: function () {
      return copyMap(this, new Map());
    }
  };

  /**
    @class MapWithDefault
    @namespace Ember
    @extends Ember.Map
    @private
    @constructor
    @param [options]
      @param {*} [options.defaultValue]
  */
  function MapWithDefault(options) {
    this._super$constructor();
    this.defaultValue = options.defaultValue;
  }

  /**
    @method create
    @static
    @param [options]
      @param {*} [options.defaultValue]
    @return {Ember.MapWithDefault|Ember.Map} If options are passed, returns
      `Ember.MapWithDefault` otherwise returns `Ember.Map`
    @private
  */
  MapWithDefault.create = function (options) {
    if (options) {
      return new MapWithDefault(options);
    } else {
      return new Map();
    }
  };

  MapWithDefault.prototype = Object.create(Map.prototype);
  MapWithDefault.prototype.constructor = MapWithDefault;
  MapWithDefault.prototype._super$constructor = Map;
  MapWithDefault.prototype._super$get = Map.prototype.get;

  /**
    Retrieve the value associated with a given key.
  
    @method get
    @param {*} key
    @return {*} the value associated with the key, or the default value
    @private
  */
  MapWithDefault.prototype.get = function (key) {
    var hasValue = this.has(key);

    if (hasValue) {
      return this._super$get(key);
    } else {
      var defaultValue = this.defaultValue(key);
      this.set(key, defaultValue);
      return defaultValue;
    }
  };

  /**
    @method copy
    @return {Ember.MapWithDefault}
    @private
  */
  MapWithDefault.prototype.copy = function () {
    var Constructor = this.constructor;
    return copyMap(this, new Constructor({
      defaultValue: this.defaultValue
    }));
  };

  exports.default = Map;
  exports.OrderedSet = OrderedSet;
  exports.Map = Map;
  exports.MapWithDefault = MapWithDefault;
});
enifed('ember-metal/merge', ['exports'], function (exports) {
  /**
    Merge the contents of two objects together into the first object.
  
    ```javascript
    Ember.merge({ first: 'Tom' }, { last: 'Dale' }); // { first: 'Tom', last: 'Dale' }
    var a = { first: 'Yehuda' };
    var b = { last: 'Katz' };
    Ember.merge(a, b); // a == { first: 'Yehuda', last: 'Katz' }, b == { last: 'Katz' }
    ```
  
    @method merge
    @for Ember
    @param {Object} original The object to merge into
    @param {Object} updates The object to copy properties from
    @return {Object}
    @public
  */
  'use strict';

  exports.default = merge;

  function merge(original, updates) {
    if (!updates || typeof updates !== 'object') {
      return original;
    }

    var props = Object.keys(updates);
    var prop = undefined;

    for (var i = 0; i < props.length; i++) {
      prop = props[i];
      original[prop] = updates[prop];
    }

    return original;
  }
});
enifed('ember-metal/meta', ['exports', 'ember-utils', 'ember-metal/features', 'ember-metal/meta_listeners', 'ember-metal/debug', 'ember-metal/chains', 'require'], function (exports, _emberUtils, _emberMetalFeatures, _emberMetalMeta_listeners, _emberMetalDebug, _emberMetalChains, _require) {
  'no use strict';
  // Remove "use strict"; from transpiled module until
  // https://bugs.webkit.org/show_bug.cgi?id=138038 is fixed

  exports.deleteMeta = deleteMeta;
  exports.meta = meta;

  var counters = {
    peekCalls: 0,
    peekParentCalls: 0,
    peekPrototypeWalks: 0,
    setCalls: 0,
    deleteCalls: 0,
    metaCalls: 0,
    metaInstantiated: 0
  };

  /**
  @module ember-metal
  */

  /*
   This declares several meta-programmed members on the Meta class. Such
   meta!
  
   In general, the `readable` variants will give you an object (if it
   already exists) that you can read but should not modify. The
   `writable` variants will give you a mutable object, and they will
   create it if it didn't already exist.
  
   The following methods will get generated metaprogrammatically, and
   I'm including them here for greppability:
  
   writableCache, readableCache, writeWatching,
   peekWatching, clearWatching, writeMixins,
   peekMixins, clearMixins, writeBindings,
   peekBindings, clearBindings, writeValues,
   peekValues, clearValues, writeDeps, forEachInDeps
   writableChainWatchers, readableChainWatchers, writableChains,
   readableChains, writableTag, readableTag, writableTags,
   readableTags
  */
  var members = {
    cache: ownMap,
    weak: ownMap,
    watching: inheritedMap,
    mixins: inheritedMap,
    bindings: inheritedMap,
    values: inheritedMap,
    chainWatchers: ownCustomObject,
    chains: inheritedCustomObject,
    tag: ownCustomObject,
    tags: ownMap
  };

  // FLAGS
  var SOURCE_DESTROYING = 1 << 1;
  var SOURCE_DESTROYED = 1 << 2;
  var META_DESTROYED = 1 << 3;
  var IS_PROXY = 1 << 4;

  if (true || false) {
    members.lastRendered = ownMap;
    if (_require.has('ember-debug')) {
      //https://github.com/emberjs/ember.js/issues/14732
      members.lastRenderedReferenceMap = ownMap;
      members.lastRenderedTemplateMap = ownMap;
    }
  }

  var memberNames = Object.keys(members);
  var META_FIELD = '__ember_meta__';

  var Meta = (function () {
    function Meta(obj, parentMeta) {
      var _this = this;

      babelHelpers.classCallCheck(this, Meta);

      _emberMetalDebug.runInDebug(function () {
        return counters.metaInstantiated++;
      });

      this._cache = undefined;
      this._weak = undefined;
      this._watching = undefined;
      this._mixins = undefined;
      this._bindings = undefined;
      this._values = undefined;
      this._deps = undefined;
      this._chainWatchers = undefined;
      this._chains = undefined;
      this._tag = undefined;
      this._tags = undefined;

      // initial value for all flags right now is false
      // see FLAGS const for detailed list of flags used
      this._flags = 0;

      // used only internally
      this.source = obj;

      // when meta(obj).proto === obj, the object is intended to be only a
      // prototype and doesn't need to actually be observable itself
      this.proto = undefined;

      // The next meta in our inheritance chain. We (will) track this
      // explicitly instead of using prototypical inheritance because we
      // have detailed knowledge of how each property should really be
      // inherited, and we can optimize it much better than JS runtimes.
      this.parent = parentMeta;

      if (true || false) {
        this._lastRendered = undefined;
        _emberMetalDebug.runInDebug(function () {
          _this._lastRenderedReferenceMap = undefined;
          _this._lastRenderedTemplateMap = undefined;
        });
      }

      this._initializeListeners();
    }

    Meta.prototype.isInitialized = function isInitialized(obj) {
      return this.proto !== obj;
    };

    Meta.prototype.destroy = function destroy() {
      if (this.isMetaDestroyed()) {
        return;
      }

      // remove chainWatchers to remove circular references that would prevent GC
      var nodes = undefined,
          key = undefined,
          nodeObject = undefined;
      var node = this.readableChains();
      if (node) {
        NODE_STACK.push(node);
        // process tree
        while (NODE_STACK.length > 0) {
          node = NODE_STACK.pop();
          // push children
          nodes = node._chains;
          if (nodes) {
            for (key in nodes) {
              if (nodes[key] !== undefined) {
                NODE_STACK.push(nodes[key]);
              }
            }
          }

          // remove chainWatcher in node object
          if (node._watching) {
            nodeObject = node._object;
            if (nodeObject) {
              var foreignMeta = peekMeta(nodeObject);
              // avoid cleaning up chain watchers when both current and
              // foreign objects are being destroyed
              // if both are being destroyed manual cleanup is not needed
              // as they will be GC'ed and no non-destroyed references will
              // be remaining
              if (foreignMeta && !foreignMeta.isSourceDestroying()) {
                _emberMetalChains.removeChainWatcher(nodeObject, node._key, node, foreignMeta);
              }
            }
          }
        }
      }

      this.setMetaDestroyed();
    };

    Meta.prototype.isSourceDestroying = function isSourceDestroying() {
      return (this._flags & SOURCE_DESTROYING) !== 0;
    };

    Meta.prototype.setSourceDestroying = function setSourceDestroying() {
      this._flags |= SOURCE_DESTROYING;
    };

    Meta.prototype.isSourceDestroyed = function isSourceDestroyed() {
      return (this._flags & SOURCE_DESTROYED) !== 0;
    };

    Meta.prototype.setSourceDestroyed = function setSourceDestroyed() {
      this._flags |= SOURCE_DESTROYED;
    };

    Meta.prototype.isMetaDestroyed = function isMetaDestroyed() {
      return (this._flags & META_DESTROYED) !== 0;
    };

    Meta.prototype.setMetaDestroyed = function setMetaDestroyed() {
      this._flags |= META_DESTROYED;
    };

    Meta.prototype.isProxy = function isProxy() {
      return (this._flags & IS_PROXY) !== 0;
    };

    Meta.prototype.setProxy = function setProxy() {
      this._flags |= IS_PROXY;
    };

    Meta.prototype._getOrCreateOwnMap = function _getOrCreateOwnMap(key) {
      return this[key] || (this[key] = new _emberUtils.EmptyObject());
    };

    Meta.prototype._getInherited = function _getInherited(key) {
      var pointer = this;
      while (pointer !== undefined) {
        if (pointer[key]) {
          return pointer[key];
        }
        pointer = pointer.parent;
      }
    };

    Meta.prototype._findInherited = function _findInherited(key, subkey) {
      var pointer = this;
      while (pointer !== undefined) {
        var map = pointer[key];
        if (map) {
          var value = map[subkey];
          if (value !== undefined) {
            return value;
          }
        }
        pointer = pointer.parent;
      }
    };

    // Implements a member that provides a lazily created map of maps,
    // with inheritance at both levels.

    Meta.prototype.writeDeps = function writeDeps(subkey, itemkey, value) {
      _emberMetalDebug.assert('Cannot call writeDeps after the object is destroyed.', !this.isMetaDestroyed());

      var outerMap = this._getOrCreateOwnMap('_deps');
      var innerMap = outerMap[subkey];
      if (!innerMap) {
        innerMap = outerMap[subkey] = new _emberUtils.EmptyObject();
      }
      innerMap[itemkey] = value;
    };

    Meta.prototype.peekDeps = function peekDeps(subkey, itemkey) {
      var pointer = this;
      while (pointer !== undefined) {
        var map = pointer._deps;
        if (map) {
          var value = map[subkey];
          if (value) {
            if (value[itemkey] !== undefined) {
              return value[itemkey];
            }
          }
        }
        pointer = pointer.parent;
      }
    };

    Meta.prototype.hasDeps = function hasDeps(subkey) {
      var pointer = this;
      while (pointer !== undefined) {
        if (pointer._deps && pointer._deps[subkey]) {
          return true;
        }
        pointer = pointer.parent;
      }
      return false;
    };

    Meta.prototype.forEachInDeps = function forEachInDeps(subkey, fn) {
      return this._forEachIn('_deps', subkey, fn);
    };

    Meta.prototype._forEachIn = function _forEachIn(key, subkey, fn) {
      var pointer = this;
      var seen = new _emberUtils.EmptyObject();
      var calls = [];
      while (pointer !== undefined) {
        var map = pointer[key];
        if (map) {
          var innerMap = map[subkey];
          if (innerMap) {
            for (var innerKey in innerMap) {
              if (!seen[innerKey]) {
                seen[innerKey] = true;
                calls.push([innerKey, innerMap[innerKey]]);
              }
            }
          }
        }
        pointer = pointer.parent;
      }
      for (var i = 0; i < calls.length; i++) {
        var _calls$i = calls[i];
        var innerKey = _calls$i[0];
        var value = _calls$i[1];

        fn(innerKey, value);
      }
    };

    Meta.prototype.readInheritedValue = function readInheritedValue(key, subkey) {
      var internalKey = '_' + key;

      var pointer = this;

      while (pointer !== undefined) {
        var map = pointer[internalKey];
        if (map) {
          var value = map[subkey];
          if (value !== undefined || subkey in map) {
            return map[subkey];
          }
        }
        pointer = pointer.parent;
      }

      return UNDEFINED;
    };

    Meta.prototype.writeValue = function writeValue(obj, key, value) {
      var descriptor = _emberUtils.lookupDescriptor(obj, key);
      var isMandatorySetter = descriptor && descriptor.set && descriptor.set.isMandatorySetter;

      if (isMandatorySetter) {
        this.writeValues(key, value);
      } else {
        obj[key] = value;
      }
    };

    return Meta;
  })();

  exports.Meta = Meta;

  var NODE_STACK = [];

  for (var _name in _emberMetalMeta_listeners.protoMethods) {
    Meta.prototype[_name] = _emberMetalMeta_listeners.protoMethods[_name];
  }
  memberNames.forEach(function (name) {
    return members[name](name, Meta);
  });

  // Implements a member that is a lazily created, non-inheritable
  // POJO.
  function ownMap(name, Meta) {
    var key = memberProperty(name);
    var capitalized = capitalize(name);
    Meta.prototype['writable' + capitalized] = function () {
      return this._getOrCreateOwnMap(key);
    };
    Meta.prototype['readable' + capitalized] = function () {
      return this[key];
    };
  }

  // Implements a member that is a lazily created POJO with inheritable
  // values.
  function inheritedMap(name, Meta) {
    var key = memberProperty(name);
    var capitalized = capitalize(name);

    Meta.prototype['write' + capitalized] = function (subkey, value) {
      _emberMetalDebug.assert('Cannot call write' + capitalized + ' after the object is destroyed.', !this.isMetaDestroyed());

      var map = this._getOrCreateOwnMap(key);
      map[subkey] = value;
    };

    Meta.prototype['peek' + capitalized] = function (subkey) {
      return this._findInherited(key, subkey);
    };

    Meta.prototype['forEach' + capitalized] = function (fn) {
      var pointer = this;
      var seen = new _emberUtils.EmptyObject();
      while (pointer !== undefined) {
        var map = pointer[key];
        if (map) {
          for (var _key in map) {
            if (!seen[_key]) {
              seen[_key] = true;
              fn(_key, map[_key]);
            }
          }
        }
        pointer = pointer.parent;
      }
    };

    Meta.prototype['clear' + capitalized] = function () {
      _emberMetalDebug.assert('Cannot call clear' + capitalized + ' after the object is destroyed.', !this.isMetaDestroyed());

      this[key] = undefined;
    };

    Meta.prototype['deleteFrom' + capitalized] = function (subkey) {
      delete this._getOrCreateOwnMap(key)[subkey];
    };

    Meta.prototype['hasIn' + capitalized] = function (subkey) {
      return this._findInherited(key, subkey) !== undefined;
    };
  }

  var UNDEFINED = _emberUtils.symbol('undefined');

  exports.UNDEFINED = UNDEFINED;
  // Implements a member that provides a non-heritable, lazily-created
  // object using the method you provide.
  function ownCustomObject(name, Meta) {
    var key = memberProperty(name);
    var capitalized = capitalize(name);
    Meta.prototype['writable' + capitalized] = function (create) {
      _emberMetalDebug.assert('Cannot call writable' + capitalized + ' after the object is destroyed.', !this.isMetaDestroyed());

      var ret = this[key];
      if (!ret) {
        ret = this[key] = create(this.source);
      }
      return ret;
    };
    Meta.prototype['readable' + capitalized] = function () {
      return this[key];
    };
  }

  // Implements a member that provides an inheritable, lazily-created
  // object using the method you provide. We will derived children from
  // their parents by calling your object's `copy()` method.
  function inheritedCustomObject(name, Meta) {
    var key = memberProperty(name);
    var capitalized = capitalize(name);
    Meta.prototype['writable' + capitalized] = function (create) {
      _emberMetalDebug.assert('Cannot call writable' + capitalized + ' after the object is destroyed.', !this.isMetaDestroyed());

      var ret = this[key];
      if (!ret) {
        if (this.parent) {
          ret = this[key] = this.parent['writable' + capitalized](create).copy(this.source);
        } else {
          ret = this[key] = create(this.source);
        }
      }
      return ret;
    };
    Meta.prototype['readable' + capitalized] = function () {
      return this._getInherited(key);
    };
  }

  function memberProperty(name) {
    return '_' + name;
  }

  // there's a more general-purpose capitalize in ember-runtime, but we
  // don't want to make ember-metal depend on ember-runtime.
  function capitalize(name) {
    return name.replace(/^\w/, function (m) {
      return m.toUpperCase();
    });
  }

  var META_DESC = {
    writable: true,
    configurable: true,
    enumerable: false,
    value: null
  };

  exports.META_DESC = META_DESC;
  var EMBER_META_PROPERTY = {
    name: META_FIELD,
    descriptor: META_DESC
  };

  if (true) {
    Meta.prototype.readInheritedValue = function (key, subkey) {
      var internalKey = '_' + key;

      var pointer = this;

      while (pointer !== undefined) {
        var map = pointer[internalKey];
        if (map) {
          var value = map[subkey];
          if (value !== undefined || subkey in map) {
            return map[subkey];
          }
        }
        pointer = pointer.parent;
      }

      return UNDEFINED;
    };

    Meta.prototype.writeValue = function (obj, key, value) {
      var descriptor = _emberUtils.lookupDescriptor(obj, key);
      var isMandatorySetter = descriptor && descriptor.set && descriptor.set.isMandatorySetter;

      if (isMandatorySetter) {
        this.writeValues(key, value);
      } else {
        obj[key] = value;
      }
    };
  }

  var setMeta = undefined,
      peekMeta = undefined;

  // choose the one appropriate for given platform
  if (_emberUtils.HAS_NATIVE_WEAKMAP) {
    (function () {
      var getPrototypeOf = Object.getPrototypeOf;
      var metaStore = new WeakMap();

      exports.setMeta = setMeta = function WeakMap_setMeta(obj, meta) {
        _emberMetalDebug.runInDebug(function () {
          return counters.setCalls++;
        });
        metaStore.set(obj, meta);
      };

      exports.peekMeta = peekMeta = function WeakMap_peekMeta(obj) {
        _emberMetalDebug.runInDebug(function () {
          return counters.peekCalls++;
        });

        return metaStore.get(obj);
      };

      exports.peekMeta = peekMeta = function WeakMap_peekParentMeta(obj) {
        var pointer = obj;
        var meta = undefined;
        while (pointer) {
          meta = metaStore.get(pointer);
          // jshint loopfunc:true
          _emberMetalDebug.runInDebug(function () {
            return counters.peekCalls++;
          });
          // stop if we find a `null` value, since
          // that means the meta was deleted
          // any other truthy value is a "real" meta
          if (meta === null || meta) {
            return meta;
          }

          pointer = getPrototypeOf(pointer);
          _emberMetalDebug.runInDebug(function () {
            return counters.peakPrototypeWalks++;
          });
        }
      };
    })();
  } else {
    exports.setMeta = setMeta = function Fallback_setMeta(obj, meta) {
      // if `null` already, just set it to the new value
      // otherwise define property first
      if (obj[META_FIELD] !== null) {
        if (obj.__defineNonEnumerable) {
          obj.__defineNonEnumerable(EMBER_META_PROPERTY);
        } else {
          Object.defineProperty(obj, META_FIELD, META_DESC);
        }
      }

      obj[META_FIELD] = meta;
    };

    exports.peekMeta = peekMeta = function Fallback_peekMeta(obj) {
      return obj[META_FIELD];
    };
  }

  function deleteMeta(obj) {
    _emberMetalDebug.runInDebug(function () {
      return counters.deleteCalls++;
    });

    var meta = peekMeta(obj);
    if (meta) {
      meta.destroy();
    }
  }

  /**
    Retrieves the meta hash for an object. If `writable` is true ensures the
    hash is writable for this object as well.
  
    The meta object contains information about computed property descriptors as
    well as any watched properties and other information. You generally will
    not access this information directly but instead work with higher level
    methods that manipulate this hash indirectly.
  
    @method meta
    @for Ember
    @private
  
    @param {Object} obj The object to retrieve meta for
    @param {Boolean} [writable=true] Pass `false` if you do not intend to modify
      the meta hash, allowing the method to avoid making an unnecessary copy.
    @return {Object} the meta hash for an object
  */

  function meta(obj) {
    _emberMetalDebug.runInDebug(function () {
      return counters.metaCalls++;
    });

    var maybeMeta = peekMeta(obj);
    var parent = undefined;

    // remove this code, in-favor of explicit parent
    if (maybeMeta) {
      if (maybeMeta.source === obj) {
        return maybeMeta;
      }
      parent = maybeMeta;
    }

    var newMeta = new Meta(obj, parent);
    setMeta(obj, newMeta);
    return newMeta;
  }

  exports.peekMeta = peekMeta;
  exports.setMeta = setMeta;
  exports.counters = counters;
});
enifed('ember-metal/meta_listeners', ['exports'], function (exports) {
  /*
   When we render a rich template hierarchy, the set of events that
   *might* happen tends to be much larger than the set of events that
   actually happen. This implies that we should make listener creation &
   destruction cheap, even at the cost of making event dispatch more
   expensive.
  
   Thus we store a new listener with a single push and no new
   allocations, without even bothering to do deduplication -- we can
   save that for dispatch time, if an event actually happens.
   */

  /* listener flags */
  'use strict';

  var ONCE = 1;
  exports.ONCE = ONCE;
  var SUSPENDED = 2;

  exports.SUSPENDED = SUSPENDED;
  var protoMethods = {

    addToListeners: function (eventName, target, method, flags) {
      if (!this._listeners) {
        this._listeners = [];
      }
      this._listeners.push(eventName, target, method, flags);
    },

    _finalizeListeners: function () {
      if (this._listenersFinalized) {
        return;
      }
      if (!this._listeners) {
        this._listeners = [];
      }
      var pointer = this.parent;
      while (pointer) {
        var listeners = pointer._listeners;
        if (listeners) {
          this._listeners = this._listeners.concat(listeners);
        }
        if (pointer._listenersFinalized) {
          break;
        }
        pointer = pointer.parent;
      }
      this._listenersFinalized = true;
    },

    removeFromListeners: function (eventName, target, method, didRemove) {
      var pointer = this;
      while (pointer) {
        var listeners = pointer._listeners;
        if (listeners) {
          for (var index = listeners.length - 4; index >= 0; index -= 4) {
            if (listeners[index] === eventName && (!method || listeners[index + 1] === target && listeners[index + 2] === method)) {
              if (pointer === this) {
                // we are modifying our own list, so we edit directly
                if (typeof didRemove === 'function') {
                  didRemove(eventName, target, listeners[index + 2]);
                }
                listeners.splice(index, 4);
              } else {
                // we are trying to remove an inherited listener, so we do
                // just-in-time copying to detach our own listeners from
                // our inheritance chain.
                this._finalizeListeners();
                return this.removeFromListeners(eventName, target, method);
              }
            }
          }
        }
        if (pointer._listenersFinalized) {
          break;
        }
        pointer = pointer.parent;
      }
    },

    matchingListeners: function (eventName) {
      var pointer = this;
      var result = [];
      while (pointer) {
        var listeners = pointer._listeners;
        if (listeners) {
          for (var index = 0; index < listeners.length - 3; index += 4) {
            if (listeners[index] === eventName) {
              pushUniqueListener(result, listeners, index);
            }
          }
        }
        if (pointer._listenersFinalized) {
          break;
        }
        pointer = pointer.parent;
      }
      var sus = this._suspendedListeners;
      if (sus) {
        for (var susIndex = 0; susIndex < sus.length - 2; susIndex += 3) {
          if (eventName === sus[susIndex]) {
            for (var resultIndex = 0; resultIndex < result.length - 2; resultIndex += 3) {
              if (result[resultIndex] === sus[susIndex + 1] && result[resultIndex + 1] === sus[susIndex + 2]) {
                result[resultIndex + 2] |= SUSPENDED;
              }
            }
          }
        }
      }
      return result;
    },

    suspendListeners: function (eventNames, target, method, callback) {
      var sus = this._suspendedListeners;
      if (!sus) {
        sus = this._suspendedListeners = [];
      }
      for (var i = 0; i < eventNames.length; i++) {
        sus.push(eventNames[i], target, method);
      }
      try {
        return callback.call(target);
      } finally {
        if (sus.length === eventNames.length) {
          this._suspendedListeners = undefined;
        } else {
          for (var i = sus.length - 3; i >= 0; i -= 3) {
            if (sus[i + 1] === target && sus[i + 2] === method && eventNames.indexOf(sus[i]) !== -1) {
              sus.splice(i, 3);
            }
          }
        }
      }
    },

    watchedEvents: function () {
      var pointer = this;
      var names = {};
      while (pointer) {
        var listeners = pointer._listeners;
        if (listeners) {
          for (var index = 0; index < listeners.length - 3; index += 4) {
            names[listeners[index]] = true;
          }
        }
        if (pointer._listenersFinalized) {
          break;
        }
        pointer = pointer.parent;
      }
      return Object.keys(names);
    },

    _initializeListeners: function () {
      this._listeners = undefined;
      this._listenersFinalized = undefined;
      this._suspendedListeners = undefined;
    }
  };

  exports.protoMethods = protoMethods;
  function pushUniqueListener(destination, source, index) {
    var target = source[index + 1];
    var method = source[index + 2];
    for (var destinationIndex = 0; destinationIndex < destination.length - 2; destinationIndex += 3) {
      if (destination[destinationIndex] === target && destination[destinationIndex + 1] === method) {
        return;
      }
    }
    destination.push(target, method, source[index + 3]);
  }
});
enifed('ember-metal/mixin', ['exports', 'ember-utils', 'ember-metal/error', 'ember-metal/debug', 'ember-metal/meta', 'ember-metal/expand_properties', 'ember-metal/properties', 'ember-metal/computed', 'ember-metal/binding', 'ember-metal/observer', 'ember-metal/events'], function (exports, _emberUtils, _emberMetalError, _emberMetalDebug, _emberMetalMeta, _emberMetalExpand_properties, _emberMetalProperties, _emberMetalComputed, _emberMetalBinding, _emberMetalObserver, _emberMetalEvents) {
  'no use strict';
  // Remove "use strict"; from transpiled module until
  // https://bugs.webkit.org/show_bug.cgi?id=138038 is fixed

  /**
  @module ember
  @submodule ember-metal
  */
  exports.detectBinding = detectBinding;
  exports.mixin = mixin;
  exports.hasUnprocessedMixins = hasUnprocessedMixins;
  exports.clearUnprocessedMixins = clearUnprocessedMixins;
  exports.required = required;
  exports.aliasMethod = aliasMethod;
  exports.observer = observer;
  exports._immediateObserver = _immediateObserver;
  exports._beforeObserver = _beforeObserver;

  function ROOT() {}
  ROOT.__hasSuper = false;

  var a_slice = Array.prototype.slice;
  var a_concat = Array.prototype.concat;
  var isArray = Array.isArray;

  function isMethod(obj) {
    return 'function' === typeof obj && obj.isMethod !== false && obj !== Boolean && obj !== Object && obj !== Number && obj !== Array && obj !== Date && obj !== String;
  }

  var CONTINUE = {};

  function mixinProperties(mixinsMeta, mixin) {
    var guid = undefined;

    if (mixin instanceof Mixin) {
      guid = _emberUtils.guidFor(mixin);
      if (mixinsMeta.peekMixins(guid)) {
        return CONTINUE;
      }
      mixinsMeta.writeMixins(guid, mixin);
      return mixin.properties;
    } else {
      return mixin; // apply anonymous mixin properties
    }
  }

  function concatenatedMixinProperties(concatProp, props, values, base) {
    // reset before adding each new mixin to pickup concats from previous
    var concats = values[concatProp] || base[concatProp];
    if (props[concatProp]) {
      concats = concats ? a_concat.call(concats, props[concatProp]) : props[concatProp];
    }
    return concats;
  }

  function giveDescriptorSuper(meta, key, property, values, descs, base) {
    var superProperty = undefined;

    // Computed properties override methods, and do not call super to them
    if (values[key] === undefined) {
      // Find the original descriptor in a parent mixin
      superProperty = descs[key];
    }

    // If we didn't find the original descriptor in a parent mixin, find
    // it on the original object.
    if (!superProperty) {
      var possibleDesc = base[key];
      var superDesc = possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor ? possibleDesc : undefined;

      superProperty = superDesc;
    }

    if (superProperty === undefined || !(superProperty instanceof _emberMetalComputed.ComputedProperty)) {
      return property;
    }

    // Since multiple mixins may inherit from the same parent, we need
    // to clone the computed property so that other mixins do not receive
    // the wrapped version.
    property = Object.create(property);
    property._getter = _emberUtils.wrap(property._getter, superProperty._getter);
    if (superProperty._setter) {
      if (property._setter) {
        property._setter = _emberUtils.wrap(property._setter, superProperty._setter);
      } else {
        property._setter = superProperty._setter;
      }
    }

    return property;
  }

  function giveMethodSuper(obj, key, method, values, descs) {
    var superMethod = undefined;

    // Methods overwrite computed properties, and do not call super to them.
    if (descs[key] === undefined) {
      // Find the original method in a parent mixin
      superMethod = values[key];
    }

    // If we didn't find the original value in a parent mixin, find it in
    // the original object
    superMethod = superMethod || obj[key];

    // Only wrap the new method if the original method was a function
    if (superMethod === undefined || 'function' !== typeof superMethod) {
      return method;
    }

    return _emberUtils.wrap(method, superMethod);
  }

  function applyConcatenatedProperties(obj, key, value, values) {
    var baseValue = values[key] || obj[key];
    var ret = undefined;

    if (baseValue === null || baseValue === undefined) {
      ret = _emberUtils.makeArray(value);
    } else {
      if (isArray(baseValue)) {
        if (value === null || value === undefined) {
          ret = baseValue;
        } else {
          ret = a_concat.call(baseValue, value);
        }
      } else {
        ret = a_concat.call(_emberUtils.makeArray(baseValue), value);
      }
    }

    _emberMetalDebug.runInDebug(function () {
      // it is possible to use concatenatedProperties with strings (which cannot be frozen)
      // only freeze objects...
      if (typeof ret === 'object' && ret !== null) {
        // prevent mutating `concatenatedProperties` array after it is applied
        Object.freeze(ret);
      }
    });

    return ret;
  }

  function applyMergedProperties(obj, key, value, values) {
    var baseValue = values[key] || obj[key];

    _emberMetalDebug.runInDebug(function () {
      if (isArray(value)) {
        // use conditional to avoid stringifying every time
        _emberMetalDebug.assert('You passed in `' + JSON.stringify(value) + '` as the value for `' + key + '` but `' + key + '` cannot be an Array', false);
      }
    });

    if (!baseValue) {
      return value;
    }

    var newBase = _emberUtils.assign({}, baseValue);
    var hasFunction = false;

    for (var prop in value) {
      if (!value.hasOwnProperty(prop)) {
        continue;
      }

      var propValue = value[prop];
      if (isMethod(propValue)) {
        // TODO: support for Computed Properties, etc?
        hasFunction = true;
        newBase[prop] = giveMethodSuper(obj, prop, propValue, baseValue, {});
      } else {
        newBase[prop] = propValue;
      }
    }

    if (hasFunction) {
      newBase._super = ROOT;
    }

    return newBase;
  }

  function addNormalizedProperty(base, key, value, meta, descs, values, concats, mergings) {
    if (value instanceof _emberMetalProperties.Descriptor) {
      if (value === REQUIRED && descs[key]) {
        return CONTINUE;
      }

      // Wrap descriptor function to implement
      // _super() if needed
      if (value._getter) {
        value = giveDescriptorSuper(meta, key, value, values, descs, base);
      }

      descs[key] = value;
      values[key] = undefined;
    } else {
      if (concats && concats.indexOf(key) >= 0 || key === 'concatenatedProperties' || key === 'mergedProperties') {
        value = applyConcatenatedProperties(base, key, value, values);
      } else if (mergings && mergings.indexOf(key) >= 0) {
        value = applyMergedProperties(base, key, value, values);
      } else if (isMethod(value)) {
        value = giveMethodSuper(base, key, value, values, descs);
      }

      descs[key] = undefined;
      values[key] = value;
    }
  }

  function mergeMixins(mixins, m, descs, values, base, keys) {
    var currentMixin = undefined,
        props = undefined,
        key = undefined,
        concats = undefined,
        mergings = undefined;

    function removeKeys(keyName) {
      delete descs[keyName];
      delete values[keyName];
    }

    for (var i = 0; i < mixins.length; i++) {
      currentMixin = mixins[i];
      _emberMetalDebug.assert('Expected hash or Mixin instance, got ' + Object.prototype.toString.call(currentMixin), typeof currentMixin === 'object' && currentMixin !== null && Object.prototype.toString.call(currentMixin) !== '[object Array]');

      props = mixinProperties(m, currentMixin);
      if (props === CONTINUE) {
        continue;
      }

      if (props) {
        if (base.willMergeMixin) {
          base.willMergeMixin(props);
        }
        concats = concatenatedMixinProperties('concatenatedProperties', props, values, base);
        mergings = concatenatedMixinProperties('mergedProperties', props, values, base);

        for (key in props) {
          if (!props.hasOwnProperty(key)) {
            continue;
          }
          keys.push(key);
          addNormalizedProperty(base, key, props[key], m, descs, values, concats, mergings);
        }

        // manually copy toString() because some JS engines do not enumerate it
        if (props.hasOwnProperty('toString')) {
          base.toString = props.toString;
        }
      } else if (currentMixin.mixins) {
        mergeMixins(currentMixin.mixins, m, descs, values, base, keys);
        if (currentMixin._without) {
          currentMixin._without.forEach(removeKeys);
        }
      }
    }
  }

  function detectBinding(key) {
    var length = key.length;

    return length > 7 && key.charCodeAt(length - 7) === 66 && key.indexOf('inding', length - 6) !== -1;
  }

  // warm both paths of above function
  detectBinding('notbound');
  detectBinding('fooBinding');

  function connectBindings(obj, m) {
    // TODO Mixin.apply(instance) should disconnect binding if exists
    m.forEachBindings(function (key, binding) {
      if (binding) {
        var to = key.slice(0, -7); // strip Binding off end
        if (binding instanceof _emberMetalBinding.Binding) {
          binding = binding.copy(); // copy prototypes' instance
          binding.to(to);
        } else {
          // binding is string path
          binding = new _emberMetalBinding.Binding(to, binding);
        }
        binding.connect(obj);
        obj[key] = binding;
      }
    });
    // mark as applied
    m.clearBindings();
  }

  function finishPartial(obj, m) {
    connectBindings(obj, m || _emberMetalMeta.meta(obj));
    return obj;
  }

  function followAlias(obj, desc, m, descs, values) {
    var altKey = desc.methodName;
    var value = undefined;
    var possibleDesc = undefined;
    if (descs[altKey] || values[altKey]) {
      value = values[altKey];
      desc = descs[altKey];
    } else if ((possibleDesc = obj[altKey]) && possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor) {
      desc = possibleDesc;
      value = undefined;
    } else {
      desc = undefined;
      value = obj[altKey];
    }

    return { desc: desc, value: value };
  }

  function updateObserversAndListeners(obj, key, observerOrListener, pathsKey, updateMethod) {
    var paths = observerOrListener[pathsKey];

    if (paths) {
      for (var i = 0; i < paths.length; i++) {
        updateMethod(obj, paths[i], null, key);
      }
    }
  }

  function replaceObserversAndListeners(obj, key, observerOrListener) {
    var prev = obj[key];

    if ('function' === typeof prev) {
      updateObserversAndListeners(obj, key, prev, '__ember_observesBefore__', _emberMetalObserver._removeBeforeObserver);
      updateObserversAndListeners(obj, key, prev, '__ember_observes__', _emberMetalObserver.removeObserver);
      updateObserversAndListeners(obj, key, prev, '__ember_listens__', _emberMetalEvents.removeListener);
    }

    if ('function' === typeof observerOrListener) {
      updateObserversAndListeners(obj, key, observerOrListener, '__ember_observesBefore__', _emberMetalObserver._addBeforeObserver);
      updateObserversAndListeners(obj, key, observerOrListener, '__ember_observes__', _emberMetalObserver.addObserver);
      updateObserversAndListeners(obj, key, observerOrListener, '__ember_listens__', _emberMetalEvents.addListener);
    }
  }

  function applyMixin(obj, mixins, partial) {
    var descs = {};
    var values = {};
    var m = _emberMetalMeta.meta(obj);
    var keys = [];
    var key = undefined,
        value = undefined,
        desc = undefined;

    obj._super = ROOT;

    // Go through all mixins and hashes passed in, and:
    //
    // * Handle concatenated properties
    // * Handle merged properties
    // * Set up _super wrapping if necessary
    // * Set up computed property descriptors
    // * Copying `toString` in broken browsers
    mergeMixins(mixins, m, descs, values, obj, keys);

    for (var i = 0; i < keys.length; i++) {
      key = keys[i];
      if (key === 'constructor' || !values.hasOwnProperty(key)) {
        continue;
      }

      desc = descs[key];
      value = values[key];

      if (desc === REQUIRED) {
        continue;
      }

      while (desc && desc instanceof Alias) {
        var followed = followAlias(obj, desc, m, descs, values);
        desc = followed.desc;
        value = followed.value;
      }

      if (desc === undefined && value === undefined) {
        continue;
      }

      replaceObserversAndListeners(obj, key, value);

      if (detectBinding(key)) {
        m.writeBindings(key, value);
      }

      _emberMetalProperties.defineProperty(obj, key, desc, value, m);
    }

    if (!partial) {
      // don't apply to prototype
      finishPartial(obj, m);
    }

    return obj;
  }

  /**
    @method mixin
    @for Ember
    @param obj
    @param mixins*
    @return obj
    @private
  */

  function mixin(obj) {
    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    applyMixin(obj, args, false);
    return obj;
  }

  /**
    The `Ember.Mixin` class allows you to create mixins, whose properties can be
    added to other classes. For instance,
  
    ```javascript
    const EditableMixin = Ember.Mixin.create({
      edit() {
        console.log('starting to edit');
        this.set('isEditing', true);
      },
      isEditing: false
    });
  
    // Mix mixins into classes by passing them as the first arguments to
    // `.extend.`
    const Comment = Ember.Object.extend(EditableMixin, {
      post: null
    });
  
    let comment = Comment.create({ 
      post: somePost 
    });
    
    comment.edit(); // outputs 'starting to edit'
    ```
  
    Note that Mixins are created with `Ember.Mixin.create`, not
    `Ember.Mixin.extend`.
  
    Note that mixins extend a constructor's prototype so arrays and object literals
    defined as properties will be shared amongst objects that implement the mixin.
    If you want to define a property in a mixin that is not shared, you can define
    it either as a computed property or have it be created on initialization of the object.
  
    ```javascript
    // filters array will be shared amongst any object implementing mixin
    const FilterableMixin = Ember.Mixin.create({
      filters: Ember.A()
    });
  
    // filters will be a separate array for every object implementing the mixin
    const FilterableMixin = Ember.Mixin.create({
      filters: Ember.computed(function() {
        return Ember.A();
      })
    });
  
    // filters will be created as a separate array during the object's initialization
    const Filterable = Ember.Mixin.create({
      init() {
        this._super(...arguments);
        this.set("filters", Ember.A());
      }
    });
    ```
  
    @class Mixin
    @namespace Ember
    @public
  */

  var Mixin = (function () {
    function Mixin(args, properties) {
      babelHelpers.classCallCheck(this, Mixin);

      this.properties = properties;

      var length = args && args.length;

      if (length > 0) {
        var m = new Array(length);

        for (var i = 0; i < length; i++) {
          var x = args[i];
          if (x instanceof Mixin) {
            m[i] = x;
          } else {
            m[i] = new Mixin(undefined, x);
          }
        }

        this.mixins = m;
      } else {
        this.mixins = undefined;
      }
      this.ownerConstructor = undefined;
      this._without = undefined;
      this[_emberUtils.GUID_KEY] = null;
      this[_emberUtils.NAME_KEY] = null;
      _emberMetalDebug.debugSeal(this);
    }

    Mixin.applyPartial = function applyPartial(obj) {
      var args = a_slice.call(arguments, 1);
      return applyMixin(obj, args, true);
    };

    /**
      @method create
      @static
      @param arguments*
      @public
    */

    Mixin.create = function create() {
      // ES6TODO: this relies on a global state?
      unprocessedFlag = true;
      var M = this;

      for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      return new M(args, undefined);
    };

    // returns the mixins currently applied to the specified object
    // TODO: Make Ember.mixin

    Mixin.mixins = function mixins(obj) {
      var m = _emberMetalMeta.peekMeta(obj);
      var ret = [];
      if (!m) {
        return ret;
      }

      m.forEachMixins(function (key, currentMixin) {
        // skip primitive mixins since these are always anonymous
        if (!currentMixin.properties) {
          ret.push(currentMixin);
        }
      });

      return ret;
    };

    return Mixin;
  })();

  exports.default = Mixin;

  Mixin._apply = applyMixin;

  Mixin.finishPartial = finishPartial;

  var unprocessedFlag = false;

  function hasUnprocessedMixins() {
    return unprocessedFlag;
  }

  function clearUnprocessedMixins() {
    unprocessedFlag = false;
  }

  var MixinPrototype = Mixin.prototype;

  /**
    @method reopen
    @param arguments*
    @private
  */
  MixinPrototype.reopen = function () {
    var currentMixin = undefined;

    if (this.properties) {
      currentMixin = new Mixin(undefined, this.properties);
      this.properties = undefined;
      this.mixins = [currentMixin];
    } else if (!this.mixins) {
      this.mixins = [];
    }

    var mixins = this.mixins;
    var idx = undefined;

    for (idx = 0; idx < arguments.length; idx++) {
      currentMixin = arguments[idx];
      _emberMetalDebug.assert('Expected hash or Mixin instance, got ' + Object.prototype.toString.call(currentMixin), typeof currentMixin === 'object' && currentMixin !== null && Object.prototype.toString.call(currentMixin) !== '[object Array]');

      if (currentMixin instanceof Mixin) {
        mixins.push(currentMixin);
      } else {
        mixins.push(new Mixin(undefined, currentMixin));
      }
    }

    return this;
  };

  /**
    @method apply
    @param obj
    @return applied object
    @private
  */
  MixinPrototype.apply = function (obj) {
    return applyMixin(obj, [this], false);
  };

  MixinPrototype.applyPartial = function (obj) {
    return applyMixin(obj, [this], true);
  };

  MixinPrototype.toString = Object.toString;

  function _detect(curMixin, targetMixin, seen) {
    var guid = _emberUtils.guidFor(curMixin);

    if (seen[guid]) {
      return false;
    }
    seen[guid] = true;

    if (curMixin === targetMixin) {
      return true;
    }
    var mixins = curMixin.mixins;
    var loc = mixins ? mixins.length : 0;
    while (--loc >= 0) {
      if (_detect(mixins[loc], targetMixin, seen)) {
        return true;
      }
    }
    return false;
  }

  /**
    @method detect
    @param obj
    @return {Boolean}
    @private
  */
  MixinPrototype.detect = function (obj) {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    if (obj instanceof Mixin) {
      return _detect(obj, this, {});
    }
    var m = _emberMetalMeta.peekMeta(obj);
    if (!m) {
      return false;
    }
    return !!m.peekMixins(_emberUtils.guidFor(this));
  };

  MixinPrototype.without = function () {
    var ret = new Mixin([this]);

    for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      args[_key3] = arguments[_key3];
    }

    ret._without = args;
    return ret;
  };

  function _keys(ret, mixin, seen) {
    if (seen[_emberUtils.guidFor(mixin)]) {
      return;
    }
    seen[_emberUtils.guidFor(mixin)] = true;

    if (mixin.properties) {
      var props = Object.keys(mixin.properties);
      for (var i = 0; i < props.length; i++) {
        var key = props[i];
        ret[key] = true;
      }
    } else if (mixin.mixins) {
      mixin.mixins.forEach(function (x) {
        return _keys(ret, x, seen);
      });
    }
  }

  MixinPrototype.keys = function () {
    var keys = {};
    var seen = {};

    _keys(keys, this, seen);
    var ret = Object.keys(keys);
    return ret;
  };

  _emberMetalDebug.debugSeal(MixinPrototype);

  var REQUIRED = new _emberMetalProperties.Descriptor();
  REQUIRED.toString = function () {
    return '(Required Property)';
  };

  /**
    Denotes a required property for a mixin
  
    @method required
    @for Ember
    @private
  */

  function required() {
    _emberMetalDebug.deprecate('Ember.required is deprecated as its behavior is inconsistent and unreliable.', false, { id: 'ember-metal.required', until: '3.0.0' });
    return REQUIRED;
  }

  function Alias(methodName) {
    this.isDescriptor = true;
    this.methodName = methodName;
  }

  Alias.prototype = new _emberMetalProperties.Descriptor();

  /**
    Makes a method available via an additional name.
  
    ```javascript
    App.Person = Ember.Object.extend({
      name: function() {
        return 'Tomhuda Katzdale';
      },
      moniker: Ember.aliasMethod('name')
    });
  
    let goodGuy = App.Person.create();
  
    goodGuy.name();    // 'Tomhuda Katzdale'
    goodGuy.moniker(); // 'Tomhuda Katzdale'
    ```
  
    @method aliasMethod
    @for Ember
    @param {String} methodName name of the method to alias
    @public
  */

  function aliasMethod(methodName) {
    return new Alias(methodName);
  }

  // ..........................................................
  // OBSERVER HELPER
  //

  /**
    Specify a method that observes property changes.
  
    ```javascript
    Ember.Object.extend({
      valueObserver: Ember.observer('value', function() {
        // Executes whenever the "value" property changes
      })
    });
    ```
  
    Also available as `Function.prototype.observes` if prototype extensions are
    enabled.
  
    @method observer
    @for Ember
    @param {String} propertyNames*
    @param {Function} func
    @return func
    @public
  */

  function observer() {
    for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
      args[_key4] = arguments[_key4];
    }

    var func = args.slice(-1)[0];
    var paths = undefined;

    var addWatchedProperty = function (path) {
      paths.push(path);
    };
    var _paths = args.slice(0, -1);

    if (typeof func !== 'function') {
      // revert to old, soft-deprecated argument ordering
      _emberMetalDebug.deprecate('Passing the dependentKeys after the callback function in Ember.observer is deprecated. Ensure the callback function is the last argument.', false, { id: 'ember-metal.observer-argument-order', until: '3.0.0' });

      func = args[0];
      _paths = args.slice(1);
    }

    paths = [];

    for (var i = 0; i < _paths.length; ++i) {
      _emberMetalExpand_properties.default(_paths[i], addWatchedProperty);
    }

    if (typeof func !== 'function') {
      throw new _emberMetalError.default('Ember.observer called without a function');
    }

    func.__ember_observes__ = paths;
    return func;
  }

  /**
    Specify a method that observes property changes.
  
    ```javascript
    Ember.Object.extend({
      valueObserver: Ember.immediateObserver('value', function() {
        // Executes whenever the "value" property changes
      })
    });
    ```
  
    In the future, `Ember.observer` may become asynchronous. In this event,
    `Ember.immediateObserver` will maintain the synchronous behavior.
  
    Also available as `Function.prototype.observesImmediately` if prototype extensions are
    enabled.
  
    @method _immediateObserver
    @for Ember
    @param {String} propertyNames*
    @param {Function} func
    @deprecated Use `Ember.observer` instead.
    @return func
    @private
  */

  function _immediateObserver() {
    _emberMetalDebug.deprecate('Usage of `Ember.immediateObserver` is deprecated, use `Ember.observer` instead.', false, { id: 'ember-metal.immediate-observer', until: '3.0.0' });

    for (var i = 0; i < arguments.length; i++) {
      var arg = arguments[i];
      _emberMetalDebug.assert('Immediate observers must observe internal properties only, not properties on other objects.', typeof arg !== 'string' || arg.indexOf('.') === -1);
    }

    return observer.apply(this, arguments);
  }

  /**
    When observers fire, they are called with the arguments `obj`, `keyName`.
  
    Note, `@each.property` observer is called per each add or replace of an element
    and it's not called with a specific enumeration item.
  
    A `_beforeObserver` fires before a property changes.
  
    @method beforeObserver
    @for Ember
    @param {String} propertyNames*
    @param {Function} func
    @return func
    @deprecated
    @private
  */

  function _beforeObserver() {
    for (var _len5 = arguments.length, args = Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
      args[_key5] = arguments[_key5];
    }

    var func = args.slice(-1)[0];
    var paths = undefined;

    var addWatchedProperty = function (path) {
      paths.push(path);
    };

    var _paths = args.slice(0, -1);

    if (typeof func !== 'function') {
      // revert to old, soft-deprecated argument ordering

      func = args[0];
      _paths = args.slice(1);
    }

    paths = [];

    for (var i = 0; i < _paths.length; ++i) {
      _emberMetalExpand_properties.default(_paths[i], addWatchedProperty);
    }

    if (typeof func !== 'function') {
      throw new _emberMetalError.default('_beforeObserver called without a function');
    }

    func.__ember_observesBefore__ = paths;
    return func;
  }

  exports.Mixin = Mixin;
  exports.REQUIRED = REQUIRED;
});
enifed('ember-metal/observer', ['exports', 'ember-metal/watching', 'ember-metal/events'], function (exports, _emberMetalWatching, _emberMetalEvents) {
  'use strict';

  exports.addObserver = addObserver;
  exports.observersFor = observersFor;
  exports.removeObserver = removeObserver;
  exports._addBeforeObserver = _addBeforeObserver;
  exports._suspendObserver = _suspendObserver;
  exports._suspendObservers = _suspendObservers;
  exports._removeBeforeObserver = _removeBeforeObserver;

  /**
  @module ember-metal
  */

  var AFTER_OBSERVERS = ':change';
  var BEFORE_OBSERVERS = ':before';

  function changeEvent(keyName) {
    return keyName + AFTER_OBSERVERS;
  }

  function beforeEvent(keyName) {
    return keyName + BEFORE_OBSERVERS;
  }

  /**
    @method addObserver
    @for Ember
    @param obj
    @param {String} _path
    @param {Object|Function} target
    @param {Function|String} [method]
    @public
  */

  function addObserver(obj, _path, target, method) {
    _emberMetalEvents.addListener(obj, changeEvent(_path), target, method);
    _emberMetalWatching.watch(obj, _path);

    return this;
  }

  function observersFor(obj, path) {
    return _emberMetalEvents.listenersFor(obj, changeEvent(path));
  }

  /**
    @method removeObserver
    @for Ember
    @param obj
    @param {String} path
    @param {Object|Function} target
    @param {Function|String} [method]
    @public
  */

  function removeObserver(obj, path, target, method) {
    _emberMetalWatching.unwatch(obj, path);
    _emberMetalEvents.removeListener(obj, changeEvent(path), target, method);

    return this;
  }

  /**
    @method _addBeforeObserver
    @for Ember
    @param obj
    @param {String} path
    @param {Object|Function} target
    @param {Function|String} [method]
    @deprecated
    @private
  */

  function _addBeforeObserver(obj, path, target, method) {
    _emberMetalEvents.addListener(obj, beforeEvent(path), target, method);
    _emberMetalWatching.watch(obj, path);

    return this;
  }

  // Suspend observer during callback.
  //
  // This should only be used by the target of the observer
  // while it is setting the observed path.

  function _suspendObserver(obj, path, target, method, callback) {
    return _emberMetalEvents.suspendListener(obj, changeEvent(path), target, method, callback);
  }

  function _suspendObservers(obj, paths, target, method, callback) {
    var events = paths.map(changeEvent);
    return _emberMetalEvents.suspendListeners(obj, events, target, method, callback);
  }

  /**
    @method removeBeforeObserver
    @for Ember
    @param obj
    @param {String} path
    @param {Object|Function} target
    @param {Function|String} [method]
    @deprecated
    @private
  */

  function _removeBeforeObserver(obj, path, target, method) {
    _emberMetalWatching.unwatch(obj, path);
    _emberMetalEvents.removeListener(obj, beforeEvent(path), target, method);

    return this;
  }
});
enifed('ember-metal/observer_set', ['exports', 'ember-utils', 'ember-metal/events'], function (exports, _emberUtils, _emberMetalEvents) {
  'use strict';

  /*
    this.observerSet = {
      [senderGuid]: { // variable name: `keySet`
        [keyName]: listIndex
      }
    },
    this.observers = [
      {
        sender: obj,
        keyName: keyName,
        eventName: eventName,
        listeners: [
          [target, method, flags]
        ]
      },
      ...
    ]
  */

  var ObserverSet = (function () {
    function ObserverSet() {
      babelHelpers.classCallCheck(this, ObserverSet);

      this.clear();
    }

    ObserverSet.prototype.add = function add(sender, keyName, eventName) {
      var observerSet = this.observerSet;
      var observers = this.observers;
      var senderGuid = _emberUtils.guidFor(sender);
      var keySet = observerSet[senderGuid];
      var index = undefined;

      if (!keySet) {
        observerSet[senderGuid] = keySet = {};
      }
      index = keySet[keyName];
      if (index === undefined) {
        index = observers.push({
          sender: sender,
          keyName: keyName,
          eventName: eventName,
          listeners: []
        }) - 1;
        keySet[keyName] = index;
      }
      return observers[index].listeners;
    };

    ObserverSet.prototype.flush = function flush() {
      var observers = this.observers;
      var i = undefined,
          observer = undefined,
          sender = undefined;
      this.clear();
      for (i = 0; i < observers.length; ++i) {
        observer = observers[i];
        sender = observer.sender;
        if (sender.isDestroying || sender.isDestroyed) {
          continue;
        }
        _emberMetalEvents.sendEvent(sender, observer.eventName, [sender, observer.keyName], observer.listeners);
      }
    };

    ObserverSet.prototype.clear = function clear() {
      this.observerSet = {};
      this.observers = [];
    };

    return ObserverSet;
  })();

  exports.default = ObserverSet;
});
enifed('ember-metal/path_cache', ['exports', 'ember-metal/cache'], function (exports, _emberMetalCache) {
  'use strict';

  exports.isGlobal = isGlobal;
  exports.isGlobalPath = isGlobalPath;
  exports.hasThis = hasThis;
  exports.isPath = isPath;
  exports.getFirstKey = getFirstKey;
  exports.getTailPath = getTailPath;

  var IS_GLOBAL = /^[A-Z$]/;
  var IS_GLOBAL_PATH = /^[A-Z$].*[\.]/;
  var HAS_THIS = 'this.';

  var isGlobalCache = new _emberMetalCache.default(1000, function (key) {
    return IS_GLOBAL.test(key);
  });
  var isGlobalPathCache = new _emberMetalCache.default(1000, function (key) {
    return IS_GLOBAL_PATH.test(key);
  });
  var hasThisCache = new _emberMetalCache.default(1000, function (key) {
    return key.lastIndexOf(HAS_THIS, 0) === 0;
  });
  var firstDotIndexCache = new _emberMetalCache.default(1000, function (key) {
    return key.indexOf('.');
  });

  var firstKeyCache = new _emberMetalCache.default(1000, function (path) {
    var index = firstDotIndexCache.get(path);
    if (index === -1) {
      return path;
    } else {
      return path.slice(0, index);
    }
  });

  var tailPathCache = new _emberMetalCache.default(1000, function (path) {
    var index = firstDotIndexCache.get(path);
    if (index !== -1) {
      return path.slice(index + 1);
    }
  });

  var caches = {
    isGlobalCache: isGlobalCache,
    isGlobalPathCache: isGlobalPathCache,
    hasThisCache: hasThisCache,
    firstDotIndexCache: firstDotIndexCache,
    firstKeyCache: firstKeyCache,
    tailPathCache: tailPathCache
  };

  exports.caches = caches;

  function isGlobal(path) {
    return isGlobalCache.get(path);
  }

  function isGlobalPath(path) {
    return isGlobalPathCache.get(path);
  }

  function hasThis(path) {
    return hasThisCache.get(path);
  }

  function isPath(path) {
    return firstDotIndexCache.get(path) !== -1;
  }

  function getFirstKey(path) {
    return firstKeyCache.get(path);
  }

  function getTailPath(path) {
    return tailPathCache.get(path);
  }
});
enifed('ember-metal/properties', ['exports', 'ember-metal/debug', 'ember-metal/features', 'ember-metal/meta', 'ember-metal/property_events'], function (exports, _emberMetalDebug, _emberMetalFeatures, _emberMetalMeta, _emberMetalProperty_events) {
  /**
  @module ember-metal
  */

  'use strict';

  exports.Descriptor = Descriptor;
  exports.MANDATORY_SETTER_FUNCTION = MANDATORY_SETTER_FUNCTION;
  exports.DEFAULT_GETTER_FUNCTION = DEFAULT_GETTER_FUNCTION;
  exports.INHERITING_GETTER_FUNCTION = INHERITING_GETTER_FUNCTION;
  exports.defineProperty = defineProperty;

  // ..........................................................
  // DESCRIPTOR
  //

  /**
    Objects of this type can implement an interface to respond to requests to
    get and set. The default implementation handles simple properties.
  
    @class Descriptor
    @private
  */

  function Descriptor() {
    this.isDescriptor = true;
  }

  var REDEFINE_SUPPORTED = (function () {
    // https://github.com/spalger/kibana/commit/b7e35e6737df585585332857a4c397dc206e7ff9
    var a = Object.create(Object.prototype, {
      prop: {
        configurable: true,
        value: 1
      }
    });

    Object.defineProperty(a, 'prop', {
      configurable: true,
      value: 2
    });

    return a.prop === 2;
  })();
  // ..........................................................
  // DEFINING PROPERTIES API
  //

  function MANDATORY_SETTER_FUNCTION(name) {
    function SETTER_FUNCTION(value) {
      var m = _emberMetalMeta.peekMeta(this);
      if (!m.isInitialized(this)) {
        m.writeValues(name, value);
      } else {
        _emberMetalDebug.assert('You must use Ember.set() to set the `' + name + '` property (of ' + this + ') to `' + value + '`.', false);
      }
    }

    SETTER_FUNCTION.isMandatorySetter = true;
    return SETTER_FUNCTION;
  }

  function DEFAULT_GETTER_FUNCTION(name) {
    return function GETTER_FUNCTION() {
      var meta = _emberMetalMeta.peekMeta(this);
      return meta && meta.peekValues(name);
    };
  }

  function INHERITING_GETTER_FUNCTION(name) {
    function IGETTER_FUNCTION() {
      var meta = _emberMetalMeta.peekMeta(this);
      var val = meta && meta.readInheritedValue('values', name);

      if (val === _emberMetalMeta.UNDEFINED) {
        var proto = Object.getPrototypeOf(this);
        return proto && proto[name];
      } else {
        return val;
      }
    }

    IGETTER_FUNCTION.isInheritingGetter = true;
    return IGETTER_FUNCTION;
  }

  /**
    NOTE: This is a low-level method used by other parts of the API. You almost
    never want to call this method directly. Instead you should use
    `Ember.mixin()` to define new properties.
  
    Defines a property on an object. This method works much like the ES5
    `Object.defineProperty()` method except that it can also accept computed
    properties and other special descriptors.
  
    Normally this method takes only three parameters. However if you pass an
    instance of `Descriptor` as the third param then you can pass an
    optional value as the fourth parameter. This is often more efficient than
    creating new descriptor hashes for each property.
  
    ## Examples
  
    ```javascript
    // ES5 compatible mode
    Ember.defineProperty(contact, 'firstName', {
      writable: true,
      configurable: false,
      enumerable: true,
      value: 'Charles'
    });
  
    // define a simple property
    Ember.defineProperty(contact, 'lastName', undefined, 'Jolley');
  
    // define a computed property
    Ember.defineProperty(contact, 'fullName', Ember.computed('firstName', 'lastName', function() {
      return this.firstName+' '+this.lastName;
    }));
    ```
  
    @private
    @method defineProperty
    @for Ember
    @param {Object} obj the object to define this property on. This may be a prototype.
    @param {String} keyName the name of the property
    @param {Descriptor} [desc] an instance of `Descriptor` (typically a
      computed property) or an ES5 descriptor.
      You must provide this or `data` but not both.
    @param {*} [data] something other than a descriptor, that will
      become the explicit value of this property.
  */

  function defineProperty(obj, keyName, desc, data, meta) {
    var possibleDesc = undefined,
        existingDesc = undefined,
        watching = undefined,
        value = undefined;

    if (!meta) {
      meta = _emberMetalMeta.meta(obj);
    }
    var watchEntry = meta.peekWatching(keyName);
    possibleDesc = obj[keyName];
    existingDesc = possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor ? possibleDesc : undefined;

    watching = watchEntry !== undefined && watchEntry > 0;

    if (existingDesc) {
      existingDesc.teardown(obj, keyName);
    }

    if (desc instanceof Descriptor) {
      value = desc;
      if (true) {
        if (watching) {
          Object.defineProperty(obj, keyName, {
            configurable: true,
            enumerable: true,
            writable: true,
            value: value
          });
        } else {
          obj[keyName] = value;
        }
      } else {
        obj[keyName] = value;
      }
      if (desc.setup) {
        desc.setup(obj, keyName);
      }
    } else {
      if (desc == null) {
        value = data;

        if (true) {
          if (watching) {
            meta.writeValues(keyName, data);

            var defaultDescriptor = {
              configurable: true,
              enumerable: true,
              set: MANDATORY_SETTER_FUNCTION(keyName),
              get: DEFAULT_GETTER_FUNCTION(keyName)
            };

            if (REDEFINE_SUPPORTED) {
              Object.defineProperty(obj, keyName, defaultDescriptor);
            } else {
              handleBrokenPhantomDefineProperty(obj, keyName, defaultDescriptor);
            }
          } else {
            obj[keyName] = data;
          }
        } else {
          obj[keyName] = data;
        }
      } else {
        value = desc;

        // fallback to ES5
        Object.defineProperty(obj, keyName, desc);
      }
    }

    // if key is being watched, override chains that
    // were initialized with the prototype
    if (watching) {
      _emberMetalProperty_events.overrideChains(obj, keyName, meta);
    }

    // The `value` passed to the `didDefineProperty` hook is
    // either the descriptor or data, whichever was passed.
    if (obj.didDefineProperty) {
      obj.didDefineProperty(obj, keyName, value);
    }

    return this;
  }

  function handleBrokenPhantomDefineProperty(obj, keyName, desc) {
    // https://github.com/ariya/phantomjs/issues/11856
    Object.defineProperty(obj, keyName, { configurable: true, writable: true, value: 'iCry' });
    Object.defineProperty(obj, keyName, desc);
  }
});
enifed('ember-metal/property_events', ['exports', 'ember-utils', 'ember-metal/meta', 'ember-metal/events', 'ember-metal/tags', 'ember-metal/observer_set', 'ember-metal/features', 'ember-metal/transaction'], function (exports, _emberUtils, _emberMetalMeta, _emberMetalEvents, _emberMetalTags, _emberMetalObserver_set, _emberMetalFeatures, _emberMetalTransaction) {
  'use strict';

  var PROPERTY_DID_CHANGE = _emberUtils.symbol('PROPERTY_DID_CHANGE');

  exports.PROPERTY_DID_CHANGE = PROPERTY_DID_CHANGE;
  var beforeObserverSet = new _emberMetalObserver_set.default();
  var observerSet = new _emberMetalObserver_set.default();
  var deferred = 0;

  // ..........................................................
  // PROPERTY CHANGES
  //

  /**
    This function is called just before an object property is about to change.
    It will notify any before observers and prepare caches among other things.
  
    Normally you will not need to call this method directly but if for some
    reason you can't directly watch a property you can invoke this method
    manually along with `Ember.propertyDidChange()` which you should call just
    after the property value changes.
  
    @method propertyWillChange
    @for Ember
    @param {Object} obj The object with the property that will change
    @param {String} keyName The property key (or path) that will change.
    @return {void}
    @private
  */
  function propertyWillChange(obj, keyName, _meta) {
    var meta = _meta || _emberMetalMeta.peekMeta(obj);

    if (meta && !meta.isInitialized(obj)) {
      return;
    }

    var watching = meta && meta.peekWatching(keyName) > 0;
    var possibleDesc = obj[keyName];
    var desc = possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor ? possibleDesc : undefined;

    if (desc && desc.willChange) {
      desc.willChange(obj, keyName);
    }

    if (watching) {
      dependentKeysWillChange(obj, keyName, meta);
      chainsWillChange(obj, keyName, meta);
      notifyBeforeObservers(obj, keyName, meta);
    }
  }

  /**
    This function is called just after an object property has changed.
    It will notify any observers and clear caches among other things.
  
    Normally you will not need to call this method directly but if for some
    reason you can't directly watch a property you can invoke this method
    manually along with `Ember.propertyWillChange()` which you should call just
    before the property value changes.
  
    @method propertyDidChange
    @for Ember
    @param {Object} obj The object with the property that will change
    @param {String} keyName The property key (or path) that will change.
    @param {Meta} meta The objects meta.
    @return {void}
    @private
  */
  function propertyDidChange(obj, keyName, _meta) {
    var meta = _meta || _emberMetalMeta.peekMeta(obj);

    if (meta && !meta.isInitialized(obj)) {
      return;
    }

    var watching = meta && meta.peekWatching(keyName) > 0;
    var possibleDesc = obj[keyName];
    var desc = possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor ? possibleDesc : undefined;

    // shouldn't this mean that we're watching this key?
    if (desc && desc.didChange) {
      desc.didChange(obj, keyName);
    }

    if (watching) {
      if (meta.hasDeps(keyName)) {
        dependentKeysDidChange(obj, keyName, meta);
      }

      chainsDidChange(obj, keyName, meta, false);
      notifyObservers(obj, keyName, meta);
    }

    if (obj[PROPERTY_DID_CHANGE]) {
      obj[PROPERTY_DID_CHANGE](keyName);
    }

    if (meta && meta.isSourceDestroying()) {
      return;
    }

    _emberMetalTags.markObjectAsDirty(meta, keyName);

    if (true || false) {
      _emberMetalTransaction.assertNotRendered(obj, keyName, meta);
    }
  }

  var WILL_SEEN = undefined,
      DID_SEEN = undefined;
  // called whenever a property is about to change to clear the cache of any dependent keys (and notify those properties of changes, etc...)
  function dependentKeysWillChange(obj, depKey, meta) {
    if (meta && meta.isSourceDestroying()) {
      return;
    }

    if (meta && meta.hasDeps(depKey)) {
      var seen = WILL_SEEN;
      var _top = !seen;

      if (_top) {
        seen = WILL_SEEN = {};
      }

      iterDeps(propertyWillChange, obj, depKey, seen, meta);

      if (_top) {
        WILL_SEEN = null;
      }
    }
  }

  // called whenever a property has just changed to update dependent keys
  function dependentKeysDidChange(obj, depKey, meta) {
    if (meta && meta.isSourceDestroying()) {
      return;
    }

    if (meta && meta.hasDeps(depKey)) {
      var seen = DID_SEEN;
      var _top2 = !seen;

      if (_top2) {
        seen = DID_SEEN = {};
      }

      iterDeps(propertyDidChange, obj, depKey, seen, meta);

      if (_top2) {
        DID_SEEN = null;
      }
    }
  }

  function iterDeps(method, obj, depKey, seen, meta) {
    var possibleDesc = undefined,
        desc = undefined;
    var guid = _emberUtils.guidFor(obj);
    var current = seen[guid];

    if (!current) {
      current = seen[guid] = {};
    }

    if (current[depKey]) {
      return;
    }

    current[depKey] = true;

    meta.forEachInDeps(depKey, function (key, value) {
      if (!value) {
        return;
      }

      possibleDesc = obj[key];
      desc = possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor ? possibleDesc : undefined;

      if (desc && desc._suspended === obj) {
        return;
      }

      method(obj, key, meta);
    });
  }

  function chainsWillChange(obj, keyName, meta) {
    var chainWatchers = meta.readableChainWatchers();
    if (chainWatchers) {
      chainWatchers.notify(keyName, false, propertyWillChange);
    }
  }

  function chainsDidChange(obj, keyName, meta) {
    var chainWatchers = meta.readableChainWatchers();
    if (chainWatchers) {
      chainWatchers.notify(keyName, true, propertyDidChange);
    }
  }

  function overrideChains(obj, keyName, meta) {
    var chainWatchers = meta.readableChainWatchers();
    if (chainWatchers) {
      chainWatchers.revalidate(keyName);
    }
  }

  /**
    @method beginPropertyChanges
    @chainable
    @private
  */
  function beginPropertyChanges() {
    deferred++;
  }

  /**
    @method endPropertyChanges
    @private
  */
  function endPropertyChanges() {
    deferred--;
    if (deferred <= 0) {
      beforeObserverSet.clear();
      observerSet.flush();
    }
  }

  /**
    Make a series of property changes together in an
    exception-safe way.
  
    ```javascript
    Ember.changeProperties(function() {
      obj1.set('foo', mayBlowUpWhenSet);
      obj2.set('bar', baz);
    });
    ```
  
    @method changeProperties
    @param {Function} callback
    @param [binding]
    @private
  */
  function changeProperties(callback, binding) {
    beginPropertyChanges();
    try {
      callback.call(binding);
    } finally {
      endPropertyChanges.call(binding);
    }
  }

  function notifyBeforeObservers(obj, keyName, meta) {
    if (meta && meta.isSourceDestroying()) {
      return;
    }

    var eventName = keyName + ':before';
    var listeners = undefined,
        added = undefined;
    if (deferred) {
      listeners = beforeObserverSet.add(obj, keyName, eventName);
      added = _emberMetalEvents.accumulateListeners(obj, eventName, listeners);
      _emberMetalEvents.sendEvent(obj, eventName, [obj, keyName], added);
    } else {
      _emberMetalEvents.sendEvent(obj, eventName, [obj, keyName]);
    }
  }

  function notifyObservers(obj, keyName, meta) {
    if (meta && meta.isSourceDestroying()) {
      return;
    }

    var eventName = keyName + ':change';
    var listeners = undefined;
    if (deferred) {
      listeners = observerSet.add(obj, keyName, eventName);
      _emberMetalEvents.accumulateListeners(obj, eventName, listeners);
    } else {
      _emberMetalEvents.sendEvent(obj, eventName, [obj, keyName]);
    }
  }

  exports.propertyWillChange = propertyWillChange;
  exports.propertyDidChange = propertyDidChange;
  exports.overrideChains = overrideChains;
  exports.beginPropertyChanges = beginPropertyChanges;
  exports.endPropertyChanges = endPropertyChanges;
  exports.changeProperties = changeProperties;
});
enifed('ember-metal/property_get', ['exports', 'ember-metal/debug', 'ember-metal/path_cache'], function (exports, _emberMetalDebug, _emberMetalPath_cache) {
  /**
  @module ember-metal
  */

  'use strict';

  exports.get = get;
  exports._getPath = _getPath;
  exports.getWithDefault = getWithDefault;

  var ALLOWABLE_TYPES = {
    object: true,
    function: true,
    string: true
  };

  // ..........................................................
  // GET AND SET
  //
  // If we are on a platform that supports accessors we can use those.
  // Otherwise simulate accessors by looking up the property directly on the
  // object.

  /**
    Gets the value of a property on an object. If the property is computed,
    the function will be invoked. If the property is not defined but the
    object implements the `unknownProperty` method then that will be invoked.
  
    ```javascript
    Ember.get(obj, "name");
    ```
  
    If you plan to run on IE8 and older browsers then you should use this
    method anytime you want to retrieve a property on an object that you don't
    know for sure is private. (Properties beginning with an underscore '_'
    are considered private.)
  
    On all newer browsers, you only need to use this method to retrieve
    properties if the property might not be defined on the object and you want
    to respect the `unknownProperty` handler. Otherwise you can ignore this
    method.
  
    Note that if the object itself is `undefined`, this method will throw
    an error.
  
    @method get
    @for Ember
    @param {Object} obj The object to retrieve from.
    @param {String} keyName The property key to retrieve
    @return {Object} the property value or `null`.
    @public
  */

  function get(obj, keyName) {
    _emberMetalDebug.assert('Get must be called with two arguments; an object and a property key', arguments.length === 2);
    _emberMetalDebug.assert('Cannot call get with \'' + keyName + '\' on an undefined object.', obj !== undefined && obj !== null);
    _emberMetalDebug.assert('The key provided to get must be a string, you passed ' + keyName, typeof keyName === 'string');
    _emberMetalDebug.assert('\'this\' in paths is not supported', !_emberMetalPath_cache.hasThis(keyName));
    _emberMetalDebug.assert('Cannot call `Ember.get` with an empty string', keyName !== '');

    var value = obj[keyName];
    var desc = value !== null && typeof value === 'object' && value.isDescriptor ? value : undefined;
    var ret = undefined;

    if (desc === undefined && _emberMetalPath_cache.isPath(keyName)) {
      return _getPath(obj, keyName);
    }

    if (desc) {
      return desc.get(obj, keyName);
    } else {
      ret = value;

      if (ret === undefined && 'object' === typeof obj && !(keyName in obj) && 'function' === typeof obj.unknownProperty) {
        return obj.unknownProperty(keyName);
      }

      return ret;
    }
  }

  function _getPath(root, path) {
    var obj = root;
    var parts = path.split('.');

    for (var i = 0; i < parts.length; i++) {
      if (!isGettable(obj)) {
        return undefined;
      }

      obj = get(obj, parts[i]);

      if (obj && obj.isDestroyed) {
        return undefined;
      }
    }

    return obj;
  }

  function isGettable(obj) {
    if (obj == null) {
      return false;
    }

    return ALLOWABLE_TYPES[typeof obj];
  }

  /**
    Retrieves the value of a property from an Object, or a default value in the
    case that the property returns `undefined`.
  
    ```javascript
    Ember.getWithDefault(person, 'lastName', 'Doe');
    ```
  
    @method getWithDefault
    @for Ember
    @param {Object} obj The object to retrieve from.
    @param {String} keyName The name of the property to retrieve
    @param {Object} defaultValue The value to return if the property value is undefined
    @return {Object} The property value or the defaultValue.
    @public
  */

  function getWithDefault(root, key, defaultValue) {
    var value = get(root, key);

    if (value === undefined) {
      return defaultValue;
    }
    return value;
  }

  exports.default = get;
});
enifed('ember-metal/property_set', ['exports', 'ember-utils', 'ember-metal/debug', 'ember-metal/features', 'ember-metal/property_get', 'ember-metal/property_events', 'ember-metal/error', 'ember-metal/path_cache', 'ember-metal/meta'], function (exports, _emberUtils, _emberMetalDebug, _emberMetalFeatures, _emberMetalProperty_get, _emberMetalProperty_events, _emberMetalError, _emberMetalPath_cache, _emberMetalMeta) {
  'use strict';

  exports.set = set;
  exports.trySet = trySet;

  /**
    Sets the value of a property on an object, respecting computed properties
    and notifying observers and other listeners of the change. If the
    property is not defined but the object implements the `setUnknownProperty`
    method then that will be invoked as well.
  
    ```javascript
    Ember.set(obj, "name", value);
    ```
  
    @method set
    @for Ember
    @param {Object} obj The object to modify.
    @param {String} keyName The property key to set
    @param {Object} value The value to set
    @return {Object} the passed value.
    @public
  */

  function set(obj, keyName, value, tolerant) {
    _emberMetalDebug.assert('Set must be called with three or four arguments; an object, a property key, a value and tolerant true/false', arguments.length === 3 || arguments.length === 4);
    _emberMetalDebug.assert('Cannot call set with \'' + keyName + '\' on an undefined object.', obj && typeof obj === 'object' || typeof obj === 'function');
    _emberMetalDebug.assert('The key provided to set must be a string, you passed ' + keyName, typeof keyName === 'string');
    _emberMetalDebug.assert('\'this\' in paths is not supported', !_emberMetalPath_cache.hasThis(keyName));
    _emberMetalDebug.assert('calling set on destroyed object: ' + _emberUtils.toString(obj) + '.' + keyName + ' = ' + _emberUtils.toString(value), !obj.isDestroyed);

    if (_emberMetalPath_cache.isPath(keyName)) {
      return setPath(obj, keyName, value, tolerant);
    }

    var meta = _emberMetalMeta.peekMeta(obj);
    var possibleDesc = obj[keyName];

    var desc = undefined,
        currentValue = undefined;
    if (possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor) {
      desc = possibleDesc;
    } else {
      currentValue = possibleDesc;
    }

    if (desc) {
      /* computed property */
      desc.set(obj, keyName, value);
    } else if (obj.setUnknownProperty && currentValue === undefined && !(keyName in obj)) {
      /* unknown property */
      _emberMetalDebug.assert('setUnknownProperty must be a function', typeof obj.setUnknownProperty === 'function');
      obj.setUnknownProperty(keyName, value);
    } else if (currentValue === value) {
      /* no change */
      return value;
    } else {
      _emberMetalProperty_events.propertyWillChange(obj, keyName);

      if (true) {
        setWithMandatorySetter(meta, obj, keyName, value);
      } else {
        obj[keyName] = value;
      }

      _emberMetalProperty_events.propertyDidChange(obj, keyName);
    }

    return value;
  }

  if (true) {
    var setWithMandatorySetter = function (meta, obj, keyName, value) {
      if (meta && meta.peekWatching(keyName) > 0) {
        makeEnumerable(obj, keyName);
        meta.writeValue(obj, keyName, value);
      } else {
        obj[keyName] = value;
      }
    };

    var makeEnumerable = function (obj, key) {
      var desc = Object.getOwnPropertyDescriptor(obj, key);

      if (desc && desc.set && desc.set.isMandatorySetter) {
        desc.enumerable = true;
        Object.defineProperty(obj, key, desc);
      }
    };
  }

  function setPath(root, path, value, tolerant) {
    // get the last part of the path
    var keyName = path.slice(path.lastIndexOf('.') + 1);

    // get the first part of the part
    path = path === keyName ? keyName : path.slice(0, path.length - (keyName.length + 1));

    // unless the path is this, look up the first part to
    // get the root
    if (path !== 'this') {
      root = _emberMetalProperty_get._getPath(root, path);
    }

    if (!keyName || keyName.length === 0) {
      throw new _emberMetalError.default('Property set failed: You passed an empty path');
    }

    if (!root) {
      if (tolerant) {
        return;
      } else {
        throw new _emberMetalError.default('Property set failed: object in path "' + path + '" could not be found or was destroyed.');
      }
    }

    return set(root, keyName, value);
  }

  /**
    Error-tolerant form of `Ember.set`. Will not blow up if any part of the
    chain is `undefined`, `null`, or destroyed.
  
    This is primarily used when syncing bindings, which may try to update after
    an object has been destroyed.
  
    @method trySet
    @for Ember
    @param {Object} root The object to modify.
    @param {String} path The property path to set
    @param {Object} value The value to set
    @public
  */

  function trySet(root, path, value) {
    return set(root, path, value, true);
  }
});
enifed("ember-metal/replace", ["exports"], function (exports) {
  "use strict";

  exports.default = replace;
  var splice = Array.prototype.splice;

  function replace(array, idx, amt, objects) {
    var args = [].concat(objects);
    var ret = [];
    // https://code.google.com/p/chromium/issues/detail?id=56588
    var size = 60000;
    var start = idx;
    var ends = amt;
    var count = undefined,
        chunk = undefined;

    while (args.length) {
      count = ends > size ? size : ends;
      if (count <= 0) {
        count = 0;
      }

      chunk = args.splice(0, size);
      chunk = [start, count].concat(chunk);

      start += size;
      ends -= count;

      ret = ret.concat(splice.apply(array, chunk));
    }
    return ret;
  }
});
enifed('ember-metal/run_loop', ['exports', 'ember-utils', 'ember-metal/debug', 'ember-metal/testing', 'ember-metal/error_handler', 'ember-metal/property_events', 'backburner'], function (exports, _emberUtils, _emberMetalDebug, _emberMetalTesting, _emberMetalError_handler, _emberMetalProperty_events, _backburner) {
  'use strict';

  exports.default = run;

  function onBegin(current) {
    run.currentRunLoop = current;
  }

  function onEnd(current, next) {
    run.currentRunLoop = next;
  }

  var onErrorTarget = {
    get onerror() {
      return _emberMetalError_handler.getOnerror();
    },
    set onerror(handler) {
      return _emberMetalError_handler.setOnerror(handler);
    }
  };

  var backburner = new _backburner.default(['sync', 'actions', 'destroy'], {
    GUID_KEY: _emberUtils.GUID_KEY,
    sync: {
      before: _emberMetalProperty_events.beginPropertyChanges,
      after: _emberMetalProperty_events.endPropertyChanges
    },
    defaultQueue: 'actions',
    onBegin: onBegin,
    onEnd: onEnd,
    onErrorTarget: onErrorTarget,
    onErrorMethod: 'onerror'
  });

  // ..........................................................
  // run - this is ideally the only public API the dev sees
  //

  /**
    Runs the passed target and method inside of a RunLoop, ensuring any
    deferred actions including bindings and views updates are flushed at the
    end.
  
    Normally you should not need to invoke this method yourself. However if
    you are implementing raw event handlers when interfacing with other
    libraries or plugins, you should probably wrap all of your code inside this
    call.
  
    ```javascript
    run(function() {
      // code to be executed within a RunLoop
    });
    ```
  
    @class run
    @namespace Ember
    @static
    @constructor
    @param {Object} [target] target of method to call
    @param {Function|String} method Method to invoke.
      May be a function or a string. If you pass a string
      then it will be looked up on the passed target.
    @param {Object} [args*] Any additional arguments you wish to pass to the method.
    @return {Object} return value from invoking the passed function.
    @public
  */

  function run() {
    return backburner.run.apply(backburner, arguments);
  }

  /**
    If no run-loop is present, it creates a new one. If a run loop is
    present it will queue itself to run on the existing run-loops action
    queue.
  
    Please note: This is not for normal usage, and should be used sparingly.
  
    If invoked when not within a run loop:
  
    ```javascript
    run.join(function() {
      // creates a new run-loop
    });
    ```
  
    Alternatively, if called within an existing run loop:
  
    ```javascript
    run(function() {
      // creates a new run-loop
      run.join(function() {
        // joins with the existing run-loop, and queues for invocation on
        // the existing run-loops action queue.
      });
    });
    ```
  
    @method join
    @namespace Ember
    @param {Object} [target] target of method to call
    @param {Function|String} method Method to invoke.
      May be a function or a string. If you pass a string
      then it will be looked up on the passed target.
    @param {Object} [args*] Any additional arguments you wish to pass to the method.
    @return {Object} Return value from invoking the passed function. Please note,
    when called within an existing loop, no return value is possible.
    @public
  */
  run.join = function () {
    return backburner.join.apply(backburner, arguments);
  };

  /**
    Allows you to specify which context to call the specified function in while
    adding the execution of that function to the Ember run loop. This ability
    makes this method a great way to asynchronously integrate third-party libraries
    into your Ember application.
  
    `run.bind` takes two main arguments, the desired context and the function to
    invoke in that context. Any additional arguments will be supplied as arguments
    to the function that is passed in.
  
    Let's use the creation of a TinyMCE component as an example. Currently,
    TinyMCE provides a setup configuration option we can use to do some processing
    after the TinyMCE instance is initialized but before it is actually rendered.
    We can use that setup option to do some additional setup for our component.
    The component itself could look something like the following:
  
    ```javascript
    App.RichTextEditorComponent = Ember.Component.extend({
      initializeTinyMCE: Ember.on('didInsertElement', function() {
        tinymce.init({
          selector: '#' + this.$().prop('id'),
          setup: Ember.run.bind(this, this.setupEditor)
        });
      }),
  
      setupEditor: function(editor) {
        this.set('editor', editor);
  
        editor.on('change', function() {
          console.log('content changed!');
        });
      }
    });
    ```
  
    In this example, we use Ember.run.bind to bind the setupEditor method to the
    context of the App.RichTextEditorComponent and to have the invocation of that
    method be safely handled and executed by the Ember run loop.
  
    @method bind
    @namespace Ember
    @param {Object} [target] target of method to call
    @param {Function|String} method Method to invoke.
      May be a function or a string. If you pass a string
      then it will be looked up on the passed target.
    @param {Object} [args*] Any additional arguments you wish to pass to the method.
    @return {Function} returns a new function that will always have a particular context
    @since 1.4.0
    @public
  */
  run.bind = function () {
    for (var _len = arguments.length, curried = Array(_len), _key = 0; _key < _len; _key++) {
      curried[_key] = arguments[_key];
    }

    return function () {
      for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      return run.join.apply(run, curried.concat(args));
    };
  };

  run.backburner = backburner;
  run.currentRunLoop = null;
  run.queues = backburner.queueNames;

  /**
    Begins a new RunLoop. Any deferred actions invoked after the begin will
    be buffered until you invoke a matching call to `run.end()`. This is
    a lower-level way to use a RunLoop instead of using `run()`.
  
    ```javascript
    run.begin();
    // code to be executed within a RunLoop
    run.end();
    ```
  
    @method begin
    @return {void}
    @public
  */
  run.begin = function () {
    backburner.begin();
  };

  /**
    Ends a RunLoop. This must be called sometime after you call
    `run.begin()` to flush any deferred actions. This is a lower-level way
    to use a RunLoop instead of using `run()`.
  
    ```javascript
    run.begin();
    // code to be executed within a RunLoop
    run.end();
    ```
  
    @method end
    @return {void}
    @public
  */
  run.end = function () {
    backburner.end();
  };

  /**
    Array of named queues. This array determines the order in which queues
    are flushed at the end of the RunLoop. You can define your own queues by
    simply adding the queue name to this array. Normally you should not need
    to inspect or modify this property.
  
    @property queues
    @type Array
    @default ['sync', 'actions', 'destroy']
    @private
  */

  /**
    Adds the passed target/method and any optional arguments to the named
    queue to be executed at the end of the RunLoop. If you have not already
    started a RunLoop when calling this method one will be started for you
    automatically.
  
    At the end of a RunLoop, any methods scheduled in this way will be invoked.
    Methods will be invoked in an order matching the named queues defined in
    the `run.queues` property.
  
    ```javascript
    run.schedule('sync', this, function() {
      // this will be executed in the first RunLoop queue, when bindings are synced
      console.log('scheduled on sync queue');
    });
  
    run.schedule('actions', this, function() {
      // this will be executed in the 'actions' queue, after bindings have synced.
      console.log('scheduled on actions queue');
    });
  
    // Note the functions will be run in order based on the run queues order.
    // Output would be:
    //   scheduled on sync queue
    //   scheduled on actions queue
    ```
  
    @method schedule
    @param {String} queue The name of the queue to schedule against.
      Default queues are 'sync' and 'actions'
    @param {Object} [target] target object to use as the context when invoking a method.
    @param {String|Function} method The method to invoke. If you pass a string it
      will be resolved on the target object at the time the scheduled item is
      invoked allowing you to change the target function.
    @param {Object} [arguments*] Optional arguments to be passed to the queued method.
    @return {*} Timer information for use in cancelling, see `run.cancel`.
    @public
  */
  run.schedule = function () /* queue, target, method */{
    _emberMetalDebug.assert('You have turned on testing mode, which disabled the run-loop\'s autorun. ' + 'You will need to wrap any code with asynchronous side-effects in a run', run.currentRunLoop || !_emberMetalTesting.isTesting());

    return backburner.schedule.apply(backburner, arguments);
  };

  // Used by global test teardown
  run.hasScheduledTimers = function () {
    return backburner.hasTimers();
  };

  // Used by global test teardown
  run.cancelTimers = function () {
    backburner.cancelTimers();
  };

  /**
    Immediately flushes any events scheduled in the 'sync' queue. Bindings
    use this queue so this method is a useful way to immediately force all
    bindings in the application to sync.
  
    You should call this method anytime you need any changed state to propagate
    throughout the app immediately without repainting the UI (which happens
    in the later 'render' queue added by the `ember-views` package).
  
    ```javascript
    run.sync();
    ```
  
    @method sync
    @return {void}
    @private
  */
  run.sync = function () {
    if (backburner.currentInstance) {
      backburner.currentInstance.queues.sync.flush();
    }
  };

  /**
    Invokes the passed target/method and optional arguments after a specified
    period of time. The last parameter of this method must always be a number
    of milliseconds.
  
    You should use this method whenever you need to run some action after a
    period of time instead of using `setTimeout()`. This method will ensure that
    items that expire during the same script execution cycle all execute
    together, which is often more efficient than using a real setTimeout.
  
    ```javascript
    run.later(myContext, function() {
      // code here will execute within a RunLoop in about 500ms with this == myContext
    }, 500);
    ```
  
    @method later
    @param {Object} [target] target of method to invoke
    @param {Function|String} method The method to invoke.
      If you pass a string it will be resolved on the
      target at the time the method is invoked.
    @param {Object} [args*] Optional arguments to pass to the timeout.
    @param {Number} wait Number of milliseconds to wait.
    @return {*} Timer information for use in cancelling, see `run.cancel`.
    @public
  */
  run.later = function () /*target, method*/{
    return backburner.later.apply(backburner, arguments);
  };

  /**
    Schedule a function to run one time during the current RunLoop. This is equivalent
    to calling `scheduleOnce` with the "actions" queue.
  
    @method once
    @param {Object} [target] The target of the method to invoke.
    @param {Function|String} method The method to invoke.
      If you pass a string it will be resolved on the
      target at the time the method is invoked.
    @param {Object} [args*] Optional arguments to pass to the timeout.
    @return {Object} Timer information for use in cancelling, see `run.cancel`.
    @public
  */
  run.once = function () {
    _emberMetalDebug.assert('You have turned on testing mode, which disabled the run-loop\'s autorun. ' + 'You will need to wrap any code with asynchronous side-effects in a run', run.currentRunLoop || !_emberMetalTesting.isTesting());

    for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      args[_key3] = arguments[_key3];
    }

    args.unshift('actions');
    return backburner.scheduleOnce.apply(backburner, args);
  };

  /**
    Schedules a function to run one time in a given queue of the current RunLoop.
    Calling this method with the same queue/target/method combination will have
    no effect (past the initial call).
  
    Note that although you can pass optional arguments these will not be
    considered when looking for duplicates. New arguments will replace previous
    calls.
  
    ```javascript
    function sayHi() {
      console.log('hi');
    }
  
    run(function() {
      run.scheduleOnce('afterRender', myContext, sayHi);
      run.scheduleOnce('afterRender', myContext, sayHi);
      // sayHi will only be executed once, in the afterRender queue of the RunLoop
    });
    ```
  
    Also note that passing an anonymous function to `run.scheduleOnce` will
    not prevent additional calls with an identical anonymous function from
    scheduling the items multiple times, e.g.:
  
    ```javascript
    function scheduleIt() {
      run.scheduleOnce('actions', myContext, function() {
        console.log('Closure');
      });
    }
  
    scheduleIt();
    scheduleIt();
  
    // "Closure" will print twice, even though we're using `run.scheduleOnce`,
    // because the function we pass to it is anonymous and won't match the
    // previously scheduled operation.
    ```
  
    Available queues, and their order, can be found at `run.queues`
  
    @method scheduleOnce
    @param {String} [queue] The name of the queue to schedule against. Default queues are 'sync' and 'actions'.
    @param {Object} [target] The target of the method to invoke.
    @param {Function|String} method The method to invoke.
      If you pass a string it will be resolved on the
      target at the time the method is invoked.
    @param {Object} [args*] Optional arguments to pass to the timeout.
    @return {Object} Timer information for use in cancelling, see `run.cancel`.
    @public
  */
  run.scheduleOnce = function () /*queue, target, method*/{
    _emberMetalDebug.assert('You have turned on testing mode, which disabled the run-loop\'s autorun. ' + 'You will need to wrap any code with asynchronous side-effects in a run', run.currentRunLoop || !_emberMetalTesting.isTesting());
    return backburner.scheduleOnce.apply(backburner, arguments);
  };

  /**
    Schedules an item to run from within a separate run loop, after
    control has been returned to the system. This is equivalent to calling
    `run.later` with a wait time of 1ms.
  
    ```javascript
    run.next(myContext, function() {
      // code to be executed in the next run loop,
      // which will be scheduled after the current one
    });
    ```
  
    Multiple operations scheduled with `run.next` will coalesce
    into the same later run loop, along with any other operations
    scheduled by `run.later` that expire right around the same
    time that `run.next` operations will fire.
  
    Note that there are often alternatives to using `run.next`.
    For instance, if you'd like to schedule an operation to happen
    after all DOM element operations have completed within the current
    run loop, you can make use of the `afterRender` run loop queue (added
    by the `ember-views` package, along with the preceding `render` queue
    where all the DOM element operations happen).
  
    Example:
  
    ```javascript
    export default Ember.Component.extend({
      didInsertElement() {
        this._super(...arguments);
        run.scheduleOnce('afterRender', this, 'processChildElements');
      },
  
      processChildElements() {
        // ... do something with component's child component
        // elements after they've finished rendering, which
        // can't be done within this component's
        // `didInsertElement` hook because that gets run
        // before the child elements have been added to the DOM.
      }
    });
    ```
  
    One benefit of the above approach compared to using `run.next` is
    that you will be able to perform DOM/CSS operations before unprocessed
    elements are rendered to the screen, which may prevent flickering or
    other artifacts caused by delaying processing until after rendering.
  
    The other major benefit to the above approach is that `run.next`
    introduces an element of non-determinism, which can make things much
    harder to test, due to its reliance on `setTimeout`; it's much harder
    to guarantee the order of scheduled operations when they are scheduled
    outside of the current run loop, i.e. with `run.next`.
  
    @method next
    @param {Object} [target] target of method to invoke
    @param {Function|String} method The method to invoke.
      If you pass a string it will be resolved on the
      target at the time the method is invoked.
    @param {Object} [args*] Optional arguments to pass to the timeout.
    @return {Object} Timer information for use in cancelling, see `run.cancel`.
    @public
  */
  run.next = function () {
    for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
      args[_key4] = arguments[_key4];
    }

    args.push(1);
    return backburner.later.apply(backburner, args);
  };

  /**
    Cancels a scheduled item. Must be a value returned by `run.later()`,
    `run.once()`, `run.scheduleOnce()`, `run.next()`, `run.debounce()`, or
    `run.throttle()`.
  
    ```javascript
    let runNext = run.next(myContext, function() {
      // will not be executed
    });
  
    run.cancel(runNext);
  
    let runLater = run.later(myContext, function() {
      // will not be executed
    }, 500);
  
    run.cancel(runLater);
  
    let runScheduleOnce = run.scheduleOnce('afterRender', myContext, function() {
      // will not be executed
    });
  
    run.cancel(runScheduleOnce);
  
    let runOnce = run.once(myContext, function() {
      // will not be executed
    });
  
    run.cancel(runOnce);
  
    let throttle = run.throttle(myContext, function() {
      // will not be executed
    }, 1, false);
  
    run.cancel(throttle);
  
    let debounce = run.debounce(myContext, function() {
      // will not be executed
    }, 1);
  
    run.cancel(debounce);
  
    let debounceImmediate = run.debounce(myContext, function() {
      // will be executed since we passed in true (immediate)
    }, 100, true);
  
    // the 100ms delay until this method can be called again will be cancelled
    run.cancel(debounceImmediate);
    ```
  
    @method cancel
    @param {Object} timer Timer object to cancel
    @return {Boolean} true if cancelled or false/undefined if it wasn't found
    @public
  */
  run.cancel = function (timer) {
    return backburner.cancel(timer);
  };

  /**
    Delay calling the target method until the debounce period has elapsed
    with no additional debounce calls. If `debounce` is called again before
    the specified time has elapsed, the timer is reset and the entire period
    must pass again before the target method is called.
  
    This method should be used when an event may be called multiple times
    but the action should only be called once when the event is done firing.
    A common example is for scroll events where you only want updates to
    happen once scrolling has ceased.
  
    ```javascript
    function whoRan() {
      console.log(this.name + ' ran.');
    }
  
    let myContext = { name: 'debounce' };
  
    run.debounce(myContext, whoRan, 150);
  
    // less than 150ms passes
    run.debounce(myContext, whoRan, 150);
  
    // 150ms passes
    // whoRan is invoked with context myContext
    // console logs 'debounce ran.' one time.
    ```
  
    Immediate allows you to run the function immediately, but debounce
    other calls for this function until the wait time has elapsed. If
    `debounce` is called again before the specified time has elapsed,
    the timer is reset and the entire period must pass again before
    the method can be called again.
  
    ```javascript
    function whoRan() {
      console.log(this.name + ' ran.');
    }
  
    let myContext = { name: 'debounce' };
  
    run.debounce(myContext, whoRan, 150, true);
  
    // console logs 'debounce ran.' one time immediately.
    // 100ms passes
    run.debounce(myContext, whoRan, 150, true);
  
    // 150ms passes and nothing else is logged to the console and
    // the debouncee is no longer being watched
    run.debounce(myContext, whoRan, 150, true);
  
    // console logs 'debounce ran.' one time immediately.
    // 150ms passes and nothing else is logged to the console and
    // the debouncee is no longer being watched
  
    ```
  
    @method debounce
    @param {Object} [target] target of method to invoke
    @param {Function|String} method The method to invoke.
      May be a function or a string. If you pass a string
      then it will be looked up on the passed target.
    @param {Object} [args*] Optional arguments to pass to the timeout.
    @param {Number} wait Number of milliseconds to wait.
    @param {Boolean} immediate Trigger the function on the leading instead
      of the trailing edge of the wait interval. Defaults to false.
    @return {Array} Timer information for use in cancelling, see `run.cancel`.
    @public
  */
  run.debounce = function () {
    return backburner.debounce.apply(backburner, arguments);
  };

  /**
    Ensure that the target method is never called more frequently than
    the specified spacing period. The target method is called immediately.
  
    ```javascript
    function whoRan() {
      console.log(this.name + ' ran.');
    }
  
    let myContext = { name: 'throttle' };
  
    run.throttle(myContext, whoRan, 150);
    // whoRan is invoked with context myContext
    // console logs 'throttle ran.'
  
    // 50ms passes
    run.throttle(myContext, whoRan, 150);
  
    // 50ms passes
    run.throttle(myContext, whoRan, 150);
  
    // 150ms passes
    run.throttle(myContext, whoRan, 150);
    // whoRan is invoked with context myContext
    // console logs 'throttle ran.'
    ```
  
    @method throttle
    @param {Object} [target] target of method to invoke
    @param {Function|String} method The method to invoke.
      May be a function or a string. If you pass a string
      then it will be looked up on the passed target.
    @param {Object} [args*] Optional arguments to pass to the timeout.
    @param {Number} spacing Number of milliseconds to space out requests.
    @param {Boolean} immediate Trigger the function on the leading instead
      of the trailing edge of the wait interval. Defaults to true.
    @return {Array} Timer information for use in cancelling, see `run.cancel`.
    @public
  */
  run.throttle = function () {
    return backburner.throttle.apply(backburner, arguments);
  };

  /**
    Add a new named queue after the specified queue.
  
    The queue to add will only be added once.
  
    @method _addQueue
    @param {String} name the name of the queue to add.
    @param {String} after the name of the queue to add after.
    @private
  */
  run._addQueue = function (name, after) {
    if (run.queues.indexOf(name) === -1) {
      run.queues.splice(run.queues.indexOf(after) + 1, 0, name);
    }
  };
});
enifed('ember-metal/set_properties', ['exports', 'ember-metal/property_events', 'ember-metal/property_set'], function (exports, _emberMetalProperty_events, _emberMetalProperty_set) {
  'use strict';

  exports.default = setProperties;

  /**
    Set a list of properties on an object. These properties are set inside
    a single `beginPropertyChanges` and `endPropertyChanges` batch, so
    observers will be buffered.
  
    ```javascript
    let anObject = Ember.Object.create();
  
    anObject.setProperties({
      firstName: 'Stanley',
      lastName: 'Stuart',
      age: 21
    });
    ```
  
    @method setProperties
    @param obj
    @param {Object} properties
    @return properties
    @public
  */

  function setProperties(obj, properties) {
    if (!properties || typeof properties !== 'object') {
      return properties;
    }
    _emberMetalProperty_events.changeProperties(function () {
      var props = Object.keys(properties);
      var propertyName = undefined;

      for (var i = 0; i < props.length; i++) {
        propertyName = props[i];

        _emberMetalProperty_set.set(obj, propertyName, properties[propertyName]);
      }
    });
    return properties;
  }
});
enifed('ember-metal/tags', ['exports', '@glimmer/reference', 'ember-metal/meta', 'require', 'ember-metal/is_proxy'], function (exports, _glimmerReference, _emberMetalMeta, _require, _emberMetalIs_proxy) {
  'use strict';

  exports.setHasViews = setHasViews;
  exports.tagForProperty = tagForProperty;
  exports.tagFor = tagFor;
  exports.markObjectAsDirty = markObjectAsDirty;

  var hasViews = function () {
    return false;
  };

  function setHasViews(fn) {
    hasViews = fn;
  }

  function makeTag() {
    return new _glimmerReference.DirtyableTag();
  }

  function tagForProperty(object, propertyKey, _meta) {
    if (_emberMetalIs_proxy.isProxy(object)) {
      return tagFor(object, _meta);
    }

    if (typeof object === 'object' && object) {
      var meta = _meta || _emberMetalMeta.meta(object);
      var tags = meta.writableTags();
      var tag = tags[propertyKey];
      if (tag) {
        return tag;
      }

      return tags[propertyKey] = makeTag();
    } else {
      return _glimmerReference.CONSTANT_TAG;
    }
  }

  function tagFor(object, _meta) {
    if (typeof object === 'object' && object) {
      var meta = _meta || _emberMetalMeta.meta(object);
      return meta.writableTag(makeTag);
    } else {
      return _glimmerReference.CONSTANT_TAG;
    }
  }

  function markObjectAsDirty(meta, propertyKey) {
    var objectTag = meta && meta.readableTag();

    if (objectTag) {
      objectTag.dirty();
    }

    var tags = meta && meta.readableTags();
    var propertyTag = tags && tags[propertyKey];

    if (propertyTag) {
      propertyTag.dirty();
    }

    if (objectTag || propertyTag) {
      ensureRunloop();
    }
  }

  var run = undefined;

  function K() {}

  function ensureRunloop() {
    if (!run) {
      run = _require.default('ember-metal/run_loop').default;
    }

    if (hasViews() && !run.backburner.currentInstance) {
      run.schedule('actions', K);
    }
  }
});
enifed("ember-metal/testing", ["exports"], function (exports) {
  "use strict";

  exports.isTesting = isTesting;
  exports.setTesting = setTesting;
  var testing = false;

  function isTesting() {
    return testing;
  }

  function setTesting(value) {
    testing = !!value;
  }
});
enifed('ember-metal/transaction', ['exports', 'ember-metal/meta', 'ember-metal/debug', 'ember-metal/features'], function (exports, _emberMetalMeta, _emberMetalDebug, _emberMetalFeatures) {
  'use strict';

  var runInTransaction = undefined,
      didRender = undefined,
      assertNotRendered = undefined;

  // detect-backtracking-rerender by default is debug build only
  // detect-glimmer-allow-backtracking-rerender can be enabled in custom builds
  if (true || false) {
    (function () {
      var counter = 0;
      var inTransaction = false;
      var shouldReflush = undefined;
      var debugStack = undefined;

      exports.default = runInTransaction = function (context, methodName) {
        shouldReflush = false;
        inTransaction = true;
        _emberMetalDebug.runInDebug(function () {
          debugStack = context.env.debugStack;
        });
        context[methodName]();
        inTransaction = false;
        counter++;
        return shouldReflush;
      };

      exports.didRender = didRender = function (object, key, reference) {
        if (!inTransaction) {
          return;
        }
        var meta = _emberMetalMeta.meta(object);
        var lastRendered = meta.writableLastRendered();
        lastRendered[key] = counter;

        _emberMetalDebug.runInDebug(function () {
          var referenceMap = meta.writableLastRenderedReferenceMap();
          referenceMap[key] = reference;

          var templateMap = meta.writableLastRenderedTemplateMap();
          if (templateMap[key] === undefined) {
            templateMap[key] = debugStack.peek();
          }
        });
      };

      exports.assertNotRendered = assertNotRendered = function (object, key, _meta) {
        var meta = _meta || _emberMetalMeta.meta(object);
        var lastRendered = meta.readableLastRendered();

        if (lastRendered && lastRendered[key] === counter) {
          _emberMetalDebug.runInDebug(function () {
            var templateMap = meta.readableLastRenderedTemplateMap();
            var lastRenderedIn = templateMap[key];
            var currentlyIn = debugStack.peek();

            var referenceMap = meta.readableLastRenderedReferenceMap();
            var lastRef = referenceMap[key];
            var parts = [];
            var label = undefined;

            if (lastRef) {
              while (lastRef && lastRef._propertyKey) {
                parts.unshift(lastRef._propertyKey);
                lastRef = lastRef._parentReference;
              }

              label = parts.join('.');
            } else {
              label = 'the same value';
            }

            var message = 'You modified "' + label + '" twice on ' + object + ' in a single render. It was rendered in ' + lastRenderedIn + ' and modified in ' + currentlyIn + '. This was unreliable and slow in Ember 1.x and';

            if (false) {
              _emberMetalDebug.deprecate(message + ' will be removed in Ember 3.0.', false, { id: 'ember-views.render-double-modify', until: '3.0.0' });
            } else {
              _emberMetalDebug.assert(message + ' is no longer supported. See https://github.com/emberjs/ember.js/issues/13948 for more details.', false);
            }
          });

          shouldReflush = true;
        }
      };
    })();
  } else {
    // in production do nothing to detect reflushes
    exports.default = runInTransaction = function (context, methodName) {
      context[methodName]();
      return false;
    };
  }

  exports.default = runInTransaction;
  exports.didRender = didRender;
  exports.assertNotRendered = assertNotRendered;
});
enifed('ember-metal/watch_key', ['exports', 'ember-utils', 'ember-metal/features', 'ember-metal/meta', 'ember-metal/properties'], function (exports, _emberUtils, _emberMetalFeatures, _emberMetalMeta, _emberMetalProperties) {
  'use strict';

  exports.watchKey = watchKey;
  exports.unwatchKey = unwatchKey;

  var handleMandatorySetter = undefined;

  function watchKey(obj, keyName, meta) {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }
    var m = meta || _emberMetalMeta.meta(obj);

    // activate watching first time
    if (!m.peekWatching(keyName)) {
      m.writeWatching(keyName, 1);

      var possibleDesc = obj[keyName];
      var desc = possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor ? possibleDesc : undefined;
      if (desc && desc.willWatch) {
        desc.willWatch(obj, keyName);
      }

      if ('function' === typeof obj.willWatchProperty) {
        obj.willWatchProperty(keyName);
      }

      if (true) {
        // NOTE: this is dropped for prod + minified builds
        handleMandatorySetter(m, obj, keyName);
      }
    } else {
      m.writeWatching(keyName, (m.peekWatching(keyName) || 0) + 1);
    }
  }

  if (true) {
    (function () {
      var hasOwnProperty = function (obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key);
      };

      var propertyIsEnumerable = function (obj, key) {
        return Object.prototype.propertyIsEnumerable.call(obj, key);
      };

      // Future traveler, although this code looks scary. It merely exists in
      // development to aid in development asertions. Production builds of
      // ember strip this entire block out
      handleMandatorySetter = function handleMandatorySetter(m, obj, keyName) {
        var descriptor = _emberUtils.lookupDescriptor(obj, keyName);
        var configurable = descriptor ? descriptor.configurable : true;
        var isWritable = descriptor ? descriptor.writable : true;
        var hasValue = descriptor ? 'value' in descriptor : true;
        var possibleDesc = descriptor && descriptor.value;
        var isDescriptor = possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor;

        if (isDescriptor) {
          return;
        }

        // this x in Y deopts, so keeping it in this function is better;
        if (configurable && isWritable && hasValue && keyName in obj) {
          var desc = {
            configurable: true,
            set: _emberMetalProperties.MANDATORY_SETTER_FUNCTION(keyName),
            enumerable: propertyIsEnumerable(obj, keyName),
            get: undefined
          };

          if (hasOwnProperty(obj, keyName)) {
            m.writeValues(keyName, obj[keyName]);
            desc.get = _emberMetalProperties.DEFAULT_GETTER_FUNCTION(keyName);
          } else {
            desc.get = _emberMetalProperties.INHERITING_GETTER_FUNCTION(keyName);
          }

          Object.defineProperty(obj, keyName, desc);
        }
      };
    })();
  }

  function unwatchKey(obj, keyName, _meta) {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }
    var meta = _meta || _emberMetalMeta.meta(obj);

    // do nothing of this object has already been destroyed
    if (meta.isSourceDestroyed()) {
      return;
    }

    var count = meta.peekWatching(keyName);
    if (count === 1) {
      meta.writeWatching(keyName, 0);

      var possibleDesc = obj[keyName];
      var desc = possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor ? possibleDesc : undefined;

      if (desc && desc.didUnwatch) {
        desc.didUnwatch(obj, keyName);
      }

      if ('function' === typeof obj.didUnwatchProperty) {
        obj.didUnwatchProperty(keyName);
      }

      if (true) {
        // It is true, the following code looks quite WAT. But have no fear, It
        // exists purely to improve development ergonomics and is removed from
        // ember.min.js and ember.prod.js builds.
        //
        // Some further context: Once a property is watched by ember, bypassing `set`
        // for mutation, will bypass observation. This code exists to assert when
        // that occurs, and attempt to provide more helpful feedback. The alternative
        // is tricky to debug partially observable properties.
        if (!desc && keyName in obj) {
          var maybeMandatoryDescriptor = _emberUtils.lookupDescriptor(obj, keyName);

          if (maybeMandatoryDescriptor.set && maybeMandatoryDescriptor.set.isMandatorySetter) {
            if (maybeMandatoryDescriptor.get && maybeMandatoryDescriptor.get.isInheritingGetter) {
              var possibleValue = meta.readInheritedValue('values', keyName);
              if (possibleValue === _emberMetalMeta.UNDEFINED) {
                delete obj[keyName];
                return;
              }
            }

            Object.defineProperty(obj, keyName, {
              configurable: true,
              enumerable: Object.prototype.propertyIsEnumerable.call(obj, keyName),
              writable: true,
              value: meta.peekValues(keyName)
            });
            meta.deleteFromValues(keyName);
          }
        }
      }
    } else if (count > 1) {
      meta.writeWatching(keyName, count - 1);
    }
  }
});
enifed('ember-metal/watch_path', ['exports', 'ember-metal/meta', 'ember-metal/chains'], function (exports, _emberMetalMeta, _emberMetalChains) {
  'use strict';

  exports.makeChainNode = makeChainNode;
  exports.watchPath = watchPath;
  exports.unwatchPath = unwatchPath;

  // get the chains for the current object. If the current object has
  // chains inherited from the proto they will be cloned and reconfigured for
  // the current object.
  function chainsFor(obj, meta) {
    return (meta || _emberMetalMeta.meta(obj)).writableChains(makeChainNode);
  }

  function makeChainNode(obj) {
    return new _emberMetalChains.ChainNode(null, null, obj);
  }

  function watchPath(obj, keyPath, meta) {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }
    var m = meta || _emberMetalMeta.meta(obj);
    var counter = m.peekWatching(keyPath) || 0;
    if (!counter) {
      // activate watching first time
      m.writeWatching(keyPath, 1);
      chainsFor(obj, m).add(keyPath);
    } else {
      m.writeWatching(keyPath, counter + 1);
    }
  }

  function unwatchPath(obj, keyPath, meta) {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }
    var m = meta || _emberMetalMeta.meta(obj);
    var counter = m.peekWatching(keyPath) || 0;

    if (counter === 1) {
      m.writeWatching(keyPath, 0);
      chainsFor(obj, m).remove(keyPath);
    } else if (counter > 1) {
      m.writeWatching(keyPath, counter - 1);
    }
  }
});
enifed('ember-metal/watching', ['exports', 'ember-metal/watch_key', 'ember-metal/watch_path', 'ember-metal/path_cache', 'ember-metal/meta'], function (exports, _emberMetalWatch_key, _emberMetalWatch_path, _emberMetalPath_cache, _emberMetalMeta) {
  /**
  @module ember-metal
  */

  'use strict';

  exports.isWatching = isWatching;
  exports.watcherCount = watcherCount;
  exports.unwatch = unwatch;
  exports.destroy = destroy;

  /**
    Starts watching a property on an object. Whenever the property changes,
    invokes `Ember.propertyWillChange` and `Ember.propertyDidChange`. This is the
    primitive used by observers and dependent keys; usually you will never call
    this method directly but instead use higher level methods like
    `Ember.addObserver()`
  
    @private
    @method watch
    @for Ember
    @param obj
    @param {String} _keyPath
  */
  function watch(obj, _keyPath, m) {
    if (!_emberMetalPath_cache.isPath(_keyPath)) {
      _emberMetalWatch_key.watchKey(obj, _keyPath, m);
    } else {
      _emberMetalWatch_path.watchPath(obj, _keyPath, m);
    }
  }

  exports.watch = watch;

  function isWatching(obj, key) {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    var meta = _emberMetalMeta.peekMeta(obj);
    return (meta && meta.peekWatching(key)) > 0;
  }

  function watcherCount(obj, key) {
    var meta = _emberMetalMeta.peekMeta(obj);
    return meta && meta.peekWatching(key) || 0;
  }

  function unwatch(obj, _keyPath, m) {
    if (!_emberMetalPath_cache.isPath(_keyPath)) {
      _emberMetalWatch_key.unwatchKey(obj, _keyPath, m);
    } else {
      _emberMetalWatch_path.unwatchPath(obj, _keyPath, m);
    }
  }

  /**
    Tears down the meta on an object so that it can be garbage collected.
    Multiple calls will have no effect.
  
    @method destroy
    @for Ember
    @param {Object} obj  the object to destroy
    @return {void}
    @private
  */

  function destroy(obj) {
    _emberMetalMeta.deleteMeta(obj);
  }
});
enifed('ember-metal/weak_map', ['exports', 'ember-utils', 'ember-metal/meta'], function (exports, _emberUtils, _emberMetalMeta) {
  'use strict';

  exports.default = WeakMap;

  var id = 0;

  // Returns whether Type(value) is Object according to the terminology in the spec
  function isObject(value) {
    return typeof value === 'object' && value !== null || typeof value === 'function';
  }

  /*
   * @class Ember.WeakMap
   * @public
   * @category ember-metal-weakmap
   *
   * A partial polyfill for [WeakMap](http://www.ecma-international.org/ecma-262/6.0/#sec-weakmap-objects).
   *
   * There is a small but important caveat. This implementation assumes that the
   * weak map will live longer (in the sense of garbage collection) than all of its
   * keys, otherwise it is possible to leak the values stored in the weak map. In
   * practice, most use cases satisfy this limitation which is why it is included
   * in ember-metal.
   */

  function WeakMap(iterable) {
    if (!(this instanceof WeakMap)) {
      throw new TypeError('Constructor WeakMap requires \'new\'');
    }

    this._id = _emberUtils.GUID_KEY + id++;

    if (iterable === null || iterable === undefined) {
      return;
    } else if (Array.isArray(iterable)) {
      for (var i = 0; i < iterable.length; i++) {
        var _iterable$i = iterable[i];
        var key = _iterable$i[0];
        var value = _iterable$i[1];

        this.set(key, value);
      }
    } else {
      throw new TypeError('The weak map constructor polyfill only supports an array argument');
    }
  }

  /*
   * @method get
   * @param key {Object | Function}
   * @return {Any} stored value
   */
  WeakMap.prototype.get = function (obj) {
    if (!isObject(obj)) {
      return undefined;
    }

    var meta = _emberMetalMeta.peekMeta(obj);
    if (meta) {
      var map = meta.readableWeak();
      if (map) {
        if (map[this._id] === _emberMetalMeta.UNDEFINED) {
          return undefined;
        }

        return map[this._id];
      }
    }
  };

  /*
   * @method set
   * @param key {Object | Function}
   * @param value {Any}
   * @return {WeakMap} the weak map
   */
  WeakMap.prototype.set = function (obj, value) {
    if (!isObject(obj)) {
      throw new TypeError('Invalid value used as weak map key');
    }

    if (value === undefined) {
      value = _emberMetalMeta.UNDEFINED;
    }

    _emberMetalMeta.meta(obj).writableWeak()[this._id] = value;

    return this;
  };

  /*
   * @method has
   * @param key {Object | Function}
   * @return {boolean} if the key exists
   */
  WeakMap.prototype.has = function (obj) {
    if (!isObject(obj)) {
      return false;
    }

    var meta = _emberMetalMeta.peekMeta(obj);
    if (meta) {
      var map = meta.readableWeak();
      if (map) {
        return map[this._id] !== undefined;
      }
    }

    return false;
  };

  /*
   * @method delete
   * @param key {Object | Function}
   * @return {boolean} if the key was deleted
   */
  WeakMap.prototype.delete = function (obj) {
    if (this.has(obj)) {
      delete _emberMetalMeta.meta(obj).writableWeak()[this._id];
      return true;
    } else {
      return false;
    }
  };

  /*
   * @method toString
   * @return {String}
   */
  WeakMap.prototype.toString = function () {
    return '[object WeakMap]';
  };
});
enifed('ember-template-compiler/compat', ['exports', 'ember-metal', 'ember-template-compiler/system/precompile', 'ember-template-compiler/system/compile', 'ember-template-compiler/system/compile-options'], function (exports, _emberMetal, _emberTemplateCompilerSystemPrecompile, _emberTemplateCompilerSystemCompile, _emberTemplateCompilerSystemCompileOptions) {
  'use strict';

  var EmberHandlebars = _emberMetal.default.Handlebars = _emberMetal.default.Handlebars || {};
  var EmberHTMLBars = _emberMetal.default.HTMLBars = _emberMetal.default.HTMLBars || {};

  EmberHTMLBars.precompile = EmberHandlebars.precompile = _emberTemplateCompilerSystemPrecompile.default;
  EmberHTMLBars.compile = EmberHandlebars.compile = _emberTemplateCompilerSystemCompile.default;
  EmberHTMLBars.registerPlugin = _emberTemplateCompilerSystemCompileOptions.registerPlugin;
});
// reexports
enifed('ember-template-compiler/index', ['exports', 'ember-metal', 'ember-environment', 'ember/version', 'ember-template-compiler/compat', 'ember-template-compiler/system/bootstrap', 'ember-template-compiler/system/precompile', 'ember-template-compiler/system/compile', 'ember-template-compiler/system/compile-options', 'ember-template-compiler/plugins'], function (exports, _emberMetal, _emberEnvironment, _emberVersion, _emberTemplateCompilerCompat, _emberTemplateCompilerSystemBootstrap, _emberTemplateCompilerSystemPrecompile, _emberTemplateCompilerSystemCompile, _emberTemplateCompilerSystemCompileOptions, _emberTemplateCompilerPlugins) {
  'use strict';

  // private API used by ember-cli-htmlbars to setup ENV and FEATURES
  if (!_emberMetal.default.ENV) {
    _emberMetal.default.ENV = _emberEnvironment.ENV;
  }
  if (!_emberMetal.default.FEATURES) {
    _emberMetal.default.FEATURES = _emberMetal.FEATURES;
  }
  if (!_emberMetal.default.VERSION) {
    _emberMetal.default.VERSION = _emberVersion.default;
  }

  exports._Ember = _emberMetal.default;
  exports.precompile = _emberTemplateCompilerSystemPrecompile.default;
  exports.compile = _emberTemplateCompilerSystemCompile.default;
  exports.compileOptions = _emberTemplateCompilerSystemCompileOptions.default;
  exports.registerPlugin = _emberTemplateCompilerSystemCompileOptions.registerPlugin;
  exports.defaultPlugins = _emberTemplateCompilerPlugins.default;

  // used for adding Ember.Handlebars.compile for backwards compat
});

// used to bootstrap templates
enifed('ember-template-compiler/plugins/assert-reserved-named-arguments', ['exports', 'ember-metal', 'ember-template-compiler/system/calculate-location-display'], function (exports, _emberMetal, _emberTemplateCompilerSystemCalculateLocationDisplay) {
  'use strict';

  exports.default = AssertReservedNamedArguments;

  function AssertReservedNamedArguments(options) {
    this.syntax = null;
    this.options = options;
  }

  AssertReservedNamedArguments.prototype.transform = function AssertReservedNamedArguments_transform(ast) {
    var moduleName = this.options.meta.moduleName;

    this.syntax.traverse(ast, {
      PathExpression: function (node) {
        if (node.original[0] === '@') {
          _emberMetal.assert(assertMessage(moduleName, node));
        }
      }
    });

    return ast;
  };

  function assertMessage(moduleName, node) {
    var path = node.original;
    var source = _emberTemplateCompilerSystemCalculateLocationDisplay.default(moduleName, node.loc);

    return '\'' + path + '\' is not a valid path. ' + source;
  }
});
enifed('ember-template-compiler/plugins/deprecate-render-model', ['exports', 'ember-metal', 'ember-template-compiler/system/calculate-location-display'], function (exports, _emberMetal, _emberTemplateCompilerSystemCalculateLocationDisplay) {
  'use strict';

  exports.default = DeprecateRenderModel;

  function DeprecateRenderModel(options) {
    this.syntax = null;
    this.options = options;
  }

  DeprecateRenderModel.prototype.transform = function DeprecateRenderModel_transform(ast) {
    var moduleName = this.options.meta.moduleName;
    var walker = new this.syntax.Walker();

    walker.visit(ast, function (node) {
      if (!validate(node)) {
        return;
      }

      each(node.params, function (param) {
        if (param.type !== 'PathExpression') {
          return;
        }

        _emberMetal.deprecate(deprecationMessage(moduleName, node, param), false, {
          id: 'ember-template-compiler.deprecate-render-model',
          until: '3.0.0',
          url: 'http://emberjs.com/deprecations/v2.x#toc_model-param-in-code-render-code-helper'
        });
      });
    });

    return ast;
  };

  function validate(node) {
    return node.type === 'MustacheStatement' && node.path.original === 'render' && node.params.length > 1;
  }

  function each(list, callback) {
    for (var i = 0, l = list.length; i < l; i++) {
      callback(list[i]);
    }
  }

  function deprecationMessage(moduleName, node, param) {
    var sourceInformation = _emberTemplateCompilerSystemCalculateLocationDisplay.default(moduleName, node.loc);
    var componentName = node.params[0].original;
    var modelName = param.original;
    var original = '{{render "' + componentName + '" ' + modelName + '}}';
    var preferred = '{{' + componentName + ' model=' + modelName + '}}';

    return 'Please refactor `' + original + '` to a component and invoke via' + (' `' + preferred + '`. ' + sourceInformation);
  }
});
enifed('ember-template-compiler/plugins/deprecate-render', ['exports', 'ember-metal', 'ember-template-compiler/system/calculate-location-display'], function (exports, _emberMetal, _emberTemplateCompilerSystemCalculateLocationDisplay) {
  'use strict';

  exports.default = DeprecateRender;

  function DeprecateRender(options) {
    this.syntax = null;
    this.options = options;
  }

  DeprecateRender.prototype.transform = function DeprecateRender_transform(ast) {
    var moduleName = this.options.meta.moduleName;
    var walker = new this.syntax.Walker();

    walker.visit(ast, function (node) {
      if (!validate(node)) {
        return;
      }

      each(node.params, function (param) {
        if (param.type !== 'StringLiteral') {
          return;
        }

        _emberMetal.deprecate(deprecationMessage(moduleName, node), false, {
          id: 'ember-template-compiler.deprecate-render',
          until: '3.0.0',
          url: 'http://emberjs.com/deprecations/v2.x#toc_code-render-code-helper'
        });
      });
    });

    return ast;
  };

  function validate(node) {
    return node.type === 'MustacheStatement' && node.path.original === 'render' && node.params.length === 1;
  }

  function each(list, callback) {
    for (var i = 0, l = list.length; i < l; i++) {
      callback(list[i]);
    }
  }

  function deprecationMessage(moduleName, node) {
    var sourceInformation = _emberTemplateCompilerSystemCalculateLocationDisplay.default(moduleName, node.loc);
    var componentName = node.params[0].original;
    var original = '{{render "' + componentName + '"}}';
    var preferred = '{{' + componentName + '}}';

    return 'Please refactor `' + original + '` to a component and invoke via' + (' `' + preferred + '`. ' + sourceInformation);
  }
});
enifed('ember-template-compiler/plugins/index', ['exports', 'ember-template-compiler/plugins/transform-old-binding-syntax', 'ember-template-compiler/plugins/transform-item-class', 'ember-template-compiler/plugins/transform-angle-bracket-components', 'ember-template-compiler/plugins/transform-input-on-to-onEvent', 'ember-template-compiler/plugins/transform-top-level-components', 'ember-template-compiler/plugins/transform-inline-link-to', 'ember-template-compiler/plugins/transform-old-class-binding-syntax', 'ember-template-compiler/plugins/transform-quoted-bindings-into-just-bindings', 'ember-template-compiler/plugins/deprecate-render-model', 'ember-template-compiler/plugins/deprecate-render', 'ember-template-compiler/plugins/assert-reserved-named-arguments', 'ember-template-compiler/plugins/transform-action-syntax', 'ember-template-compiler/plugins/transform-input-type-syntax', 'ember-template-compiler/plugins/transform-attrs-into-args', 'ember-template-compiler/plugins/transform-each-in-into-each', 'ember-template-compiler/plugins/transform-has-block-syntax'], function (exports, _emberTemplateCompilerPluginsTransformOldBindingSyntax, _emberTemplateCompilerPluginsTransformItemClass, _emberTemplateCompilerPluginsTransformAngleBracketComponents, _emberTemplateCompilerPluginsTransformInputOnToOnEvent, _emberTemplateCompilerPluginsTransformTopLevelComponents, _emberTemplateCompilerPluginsTransformInlineLinkTo, _emberTemplateCompilerPluginsTransformOldClassBindingSyntax, _emberTemplateCompilerPluginsTransformQuotedBindingsIntoJustBindings, _emberTemplateCompilerPluginsDeprecateRenderModel, _emberTemplateCompilerPluginsDeprecateRender, _emberTemplateCompilerPluginsAssertReservedNamedArguments, _emberTemplateCompilerPluginsTransformActionSyntax, _emberTemplateCompilerPluginsTransformInputTypeSyntax, _emberTemplateCompilerPluginsTransformAttrsIntoArgs, _emberTemplateCompilerPluginsTransformEachInIntoEach, _emberTemplateCompilerPluginsTransformHasBlockSyntax) {
  'use strict';

  exports.default = Object.freeze([_emberTemplateCompilerPluginsTransformOldBindingSyntax.default, _emberTemplateCompilerPluginsTransformItemClass.default, _emberTemplateCompilerPluginsTransformAngleBracketComponents.default, _emberTemplateCompilerPluginsTransformInputOnToOnEvent.default, _emberTemplateCompilerPluginsTransformTopLevelComponents.default, _emberTemplateCompilerPluginsTransformInlineLinkTo.default, _emberTemplateCompilerPluginsTransformOldClassBindingSyntax.default, _emberTemplateCompilerPluginsTransformQuotedBindingsIntoJustBindings.default, _emberTemplateCompilerPluginsDeprecateRenderModel.default, _emberTemplateCompilerPluginsDeprecateRender.default, _emberTemplateCompilerPluginsAssertReservedNamedArguments.default, _emberTemplateCompilerPluginsTransformActionSyntax.default, _emberTemplateCompilerPluginsTransformInputTypeSyntax.default, _emberTemplateCompilerPluginsTransformAttrsIntoArgs.default, _emberTemplateCompilerPluginsTransformEachInIntoEach.default, _emberTemplateCompilerPluginsTransformHasBlockSyntax.default]);
});
enifed('ember-template-compiler/plugins/transform-action-syntax', ['exports'], function (exports) {
  /**
   @module ember
   @submodule ember-glimmer
  */

  /**
    A Glimmer2 AST transformation that replaces all instances of
  
    ```handlebars
   <button {{action 'foo'}}>
   <button onblur={{action 'foo'}}>
   <button onblur={{action (action 'foo') 'bar'}}>
    ```
  
    with
  
    ```handlebars
   <button {{action this 'foo'}}>
   <button onblur={{action this 'foo'}}>
   <button onblur={{action this (action this 'foo') 'bar'}}>
    ```
  
    @private
    @class TransformActionSyntax
  */

  'use strict';

  exports.default = TransformActionSyntax;

  function TransformActionSyntax() {
    // set later within Glimmer2 to the syntax package
    this.syntax = null;
  }

  /**
    @private
    @method transform
    @param {AST} ast The AST to be transformed.
  */
  TransformActionSyntax.prototype.transform = function TransformActionSyntax_transform(ast) {
    var _syntax = this.syntax;
    var traverse = _syntax.traverse;
    var b = _syntax.builders;

    traverse(ast, {
      ElementModifierStatement: function (node) {
        if (isAction(node)) {
          insertThisAsFirstParam(node, b);
        }
      },
      MustacheStatement: function (node) {
        if (isAction(node)) {
          insertThisAsFirstParam(node, b);
        }
      },
      SubExpression: function (node) {
        if (isAction(node)) {
          insertThisAsFirstParam(node, b);
        }
      }
    });

    return ast;
  };

  function isAction(node) {
    return node.path.original === 'action';
  }

  function insertThisAsFirstParam(node, builders) {
    node.params.unshift(builders.path('this'));
  }
});
enifed('ember-template-compiler/plugins/transform-angle-bracket-components', ['exports'], function (exports) {
  'use strict';

  exports.default = TransformAngleBracketComponents;

  function TransformAngleBracketComponents() {
    // set later within HTMLBars to the syntax package
    this.syntax = null;
  }

  /**
    @private
    @method transform
    @param {AST} ast The AST to be transformed.
  */
  TransformAngleBracketComponents.prototype.transform = function TransformAngleBracketComponents_transform(ast) {
    var walker = new this.syntax.Walker();

    walker.visit(ast, function (node) {
      if (!validate(node)) {
        return;
      }

      node.tag = '<' + node.tag + '>';
    });

    return ast;
  };

  function validate(node) {
    return node.type === 'ComponentNode';
  }
});
enifed('ember-template-compiler/plugins/transform-attrs-into-args', ['exports'], function (exports) {
  /**
   @module ember
   @submodule ember-glimmer
  */

  /**
    A Glimmer2 AST transformation that replaces all instances of
  
    ```handlebars
   {{attrs.foo.bar}}
    ```
  
    to
  
    ```handlebars
   {{@foo.bar}}
    ```
  
    as well as `{{#if attrs.foo}}`, `{{deeply (nested attrs.foobar.baz)}}` etc
  
    @private
    @class TransformAttrsToProps
  */

  'use strict';

  exports.default = TransformAttrsToProps;

  function TransformAttrsToProps() {
    // set later within Glimmer2 to the syntax package
    this.syntax = null;
  }

  function isAttrs(node, symbols) {
    var name = node.parts[0];

    if (symbols.indexOf(name) !== -1) {
      return false;
    }

    if (name === 'attrs') {
      return true;
    }

    if (name === null && node.parts[1] === 'attrs') {
      node.parts.shift();
      node.original = node.original.slice(5);
      return true;
    }

    return false;
  }

  /**
    @private
    @method transform
    @param {AST} ast The AST to be transformed.
  */
  TransformAttrsToProps.prototype.transform = function TransformAttrsToProps_transform(ast) {
    var _syntax = this.syntax;
    var traverse = _syntax.traverse;
    var b = _syntax.builders;

    var stack = [[]];

    traverse(ast, {
      Program: {
        enter: function (node) {
          var parent = stack[stack.length - 1];
          stack.push(parent.concat(node.blockParams));
        },
        exit: function (node) {
          stack.pop();
        }
      },

      PathExpression: function (node) {
        if (isAttrs(node, stack[stack.length - 1])) {
          var path = b.path(node.original.substr(6));
          path.original = '@' + path.original;
          path.data = true;
          return path;
        }
      }
    });

    return ast;
  };
});
enifed('ember-template-compiler/plugins/transform-each-in-into-each', ['exports'], function (exports) {
  /**
   @module ember
   @submodule ember-glimmer
  */

  /**
    A Glimmer2 AST transformation that replaces all instances of
  
    ```handlebars
   {{#each-in iterableThing as |key value|}}
    ```
  
    with
  
    ```handlebars
   {{#each (-each-in iterableThing) as |key value|}}
    ```
  
    @private
    @class TransformHasBlockSyntax
  */

  'use strict';

  exports.default = TransformEachInIntoEach;

  function TransformEachInIntoEach() {
    // set later within Glimmer2 to the syntax package
    this.syntax = null;
  }

  /**
    @private
    @method transform
    @param {AST} ast The AST to be transformed.
  */
  TransformEachInIntoEach.prototype.transform = function TransformEachInIntoEach_transform(ast) {
    var _syntax = this.syntax;
    var traverse = _syntax.traverse;
    var b = _syntax.builders;

    traverse(ast, {
      BlockStatement: function (node) {
        if (node.path.original === 'each-in') {
          node.params[0] = b.sexpr(b.path('-each-in'), [node.params[0]]);
          return b.block(b.path('each'), node.params, node.hash, node.program, node.inverse, node.loc);
        }
      }
    });

    return ast;
  };
});
enifed('ember-template-compiler/plugins/transform-has-block-syntax', ['exports'], function (exports) {
  /**
   @module ember
   @submodule ember-glimmer
  */

  /**
    A Glimmer2 AST transformation that replaces all instances of
  
    ```handlebars
   {{hasBlock}}
    ```
  
    with
  
    ```handlebars
   {{has-block}}
    ```
  
    @private
    @class TransformHasBlockSyntax
  */

  'use strict';

  exports.default = TransformHasBlockSyntax;

  function TransformHasBlockSyntax() {
    // set later within Glimmer2 to the syntax package
    this.syntax = null;
  }

  var TRANSFORMATIONS = {
    hasBlock: 'has-block',
    hasBlockParams: 'has-block-params'
  };

  /**
    @private
    @method transform
    @param {AST} ast The AST to be transformed.
  */
  TransformHasBlockSyntax.prototype.transform = function TransformHasBlockSyntax_transform(ast) {
    var _syntax = this.syntax;
    var traverse = _syntax.traverse;
    var b = _syntax.builders;

    traverse(ast, {
      PathExpression: function (node) {
        if (TRANSFORMATIONS[node.original]) {
          return b.sexpr(b.path(TRANSFORMATIONS[node.original]));
        }
      },
      MustacheStatement: function (node) {
        if (TRANSFORMATIONS[node.path.original]) {
          return b.mustache(b.path(TRANSFORMATIONS[node.path.original]), node.params, node.hash, null, node.loc);
        }
      },
      SubExpression: function (node) {
        if (TRANSFORMATIONS[node.path.original]) {
          return b.sexpr(b.path(TRANSFORMATIONS[node.path.original]), node.params, node.hash);
        }
      }
    });

    return ast;
  };
});
enifed('ember-template-compiler/plugins/transform-inline-link-to', ['exports'], function (exports) {
  'use strict';

  exports.default = TransformInlineLinkTo;

  function TransformInlineLinkTo(options) {
    this.options = options;
    this.syntax = null;
  }

  TransformInlineLinkTo.prototype.transform = function TransformInlineLinkTo_transform(ast) {
    var _syntax = this.syntax;
    var traverse = _syntax.traverse;
    var b = _syntax.builders;

    function buildProgram(content, loc) {
      return b.program([buildStatement(content, loc)], null, loc);
    }

    function buildStatement(content, loc) {
      switch (content.type) {
        case 'PathExpression':
          return b.mustache(content, null, null, null, loc);

        case 'SubExpression':
          return b.mustache(content.path, content.params, content.hash, null, loc);

        // The default case handles literals.
        default:
          return b.text('' + content.value, loc);
      }
    }

    function unsafeHtml(expr) {
      return b.sexpr('-html-safe', [expr]);
    }

    traverse(ast, {
      MustacheStatement: function (node) {
        if (node.path.original === 'link-to') {
          var content = node.escaped ? node.params[0] : unsafeHtml(node.params[0]);
          return b.block('link-to', node.params.slice(1), node.hash, buildProgram(content, node.loc), null, node.loc);
        }
      }
    });

    return ast;
  };
});
enifed('ember-template-compiler/plugins/transform-input-on-to-onEvent', ['exports', 'ember-metal', 'ember-template-compiler/system/calculate-location-display'], function (exports, _emberMetal, _emberTemplateCompilerSystemCalculateLocationDisplay) {
  'use strict';

  exports.default = TransformInputOnToOnEvent;

  /**
   @module ember
   @submodule ember-htmlbars
  */

  /**
    An HTMLBars AST transformation that replaces all instances of
  
    ```handlebars
   {{input on="enter" action="doStuff"}}
   {{input on="key-press" action="doStuff"}}
    ```
  
    with
  
    ```handlebars
   {{input enter="doStuff"}}
   {{input key-press="doStuff"}}
    ```
  
    @private
    @class TransformInputOnToOnEvent
  */

  function TransformInputOnToOnEvent() {
    var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    // set later within HTMLBars to the syntax package
    this.syntax = null;
    this.options = options;
  }

  /**
    @private
    @method transform
    @param {AST} ast The AST to be transformed.
  */
  TransformInputOnToOnEvent.prototype.transform = function TransformInputOnToOnEvent_transform(ast) {
    var pluginContext = this;
    var b = pluginContext.syntax.builders;
    var walker = new pluginContext.syntax.Walker();
    var moduleName = pluginContext.options.meta.moduleName;

    walker.visit(ast, function (node) {
      if (pluginContext.validate(node)) {
        var action = hashPairForKey(node.hash, 'action');
        var on = hashPairForKey(node.hash, 'on');
        var onEvent = hashPairForKey(node.hash, 'onEvent');
        var normalizedOn = on || onEvent;
        var moduleInfo = _emberTemplateCompilerSystemCalculateLocationDisplay.default(moduleName, node.loc);

        if (normalizedOn && normalizedOn.value.type !== 'StringLiteral') {
          _emberMetal.deprecate('Using a dynamic value for \'#{normalizedOn.key}=\' with the \'{{input}}\' helper ' + moduleInfo + 'is deprecated.', false, { id: 'ember-template-compiler.transform-input-on-to-onEvent.dynamic-value', until: '3.0.0' });

          normalizedOn.key = 'onEvent';
          return; // exit early, as we cannot transform further
        }

        removeFromHash(node.hash, normalizedOn);
        removeFromHash(node.hash, action);

        if (!action) {
          _emberMetal.deprecate('Using \'{{input ' + normalizedOn.key + '="' + normalizedOn.value.value + '" ...}}\' without specifying an action ' + moduleInfo + 'will do nothing.', false, { id: 'ember-template-compiler.transform-input-on-to-onEvent.no-action', until: '3.0.0' });

          return; // exit early, if no action was available there is nothing to do
        }

        var specifiedOn = normalizedOn ? normalizedOn.key + '="' + normalizedOn.value.value + '" ' : '';
        if (normalizedOn && normalizedOn.value.value === 'keyPress') {
          // using `keyPress` in the root of the component will
          // clobber the keyPress event handler
          normalizedOn.value.value = 'key-press';
        }

        var expected = (normalizedOn ? normalizedOn.value.value : 'enter') + '="' + action.value.original + '"';

        _emberMetal.deprecate('Using \'{{input ' + specifiedOn + 'action="' + action.value.original + '"}}\' ' + moduleInfo + 'is deprecated. Please use \'{{input ' + expected + '}}\' instead.', false, { id: 'ember-template-compiler.transform-input-on-to-onEvent.normalized-on', until: '3.0.0' });
        if (!normalizedOn) {
          normalizedOn = b.pair('onEvent', b.string('enter'));
        }

        node.hash.pairs.push(b.pair(normalizedOn.value.value, action.value));
      }
    });

    return ast;
  };

  TransformInputOnToOnEvent.prototype.validate = function TransformWithAsToHash_validate(node) {
    return node.type === 'MustacheStatement' && node.path.original === 'input' && (hashPairForKey(node.hash, 'action') || hashPairForKey(node.hash, 'on') || hashPairForKey(node.hash, 'onEvent'));
  };

  function hashPairForKey(hash, key) {
    for (var i = 0; i < hash.pairs.length; i++) {
      var pair = hash.pairs[i];
      if (pair.key === key) {
        return pair;
      }
    }

    return false;
  }

  function removeFromHash(hash, pairToRemove) {
    var newPairs = [];
    for (var i = 0; i < hash.pairs.length; i++) {
      var pair = hash.pairs[i];

      if (pair !== pairToRemove) {
        newPairs.push(pair);
      }
    }

    hash.pairs = newPairs;
  }
});
enifed('ember-template-compiler/plugins/transform-input-type-syntax', ['exports'], function (exports) {
  /**
   @module ember
   @submodule ember-glimmer
  */

  /**
    A Glimmer2 AST transformation that replaces all instances of
  
    ```handlebars
   {{input type=boundType}}
    ```
  
    with
  
    ```handlebars
   {{input (-input-type boundType) type=boundType}}
    ```
  
    Note that the type parameters is not removed as the -input-type helpers
    is only used to select the component class. The component still needs
    the type parameter to function.
  
    @private
    @class TransformInputTypeSyntax
  */

  'use strict';

  exports.default = TransformInputTypeSyntax;

  function TransformInputTypeSyntax() {
    // set later within Glimmer2 to the syntax package
    this.syntax = null;
  }

  /**
    @private
    @method transform
    @param {AST} ast The AST to be transformed.
  */
  TransformInputTypeSyntax.prototype.transform = function TransformInputTypeSyntax_transform(ast) {
    var _syntax = this.syntax;
    var traverse = _syntax.traverse;
    var b = _syntax.builders;

    traverse(ast, {
      MustacheStatement: function (node) {
        if (isInput(node)) {
          insertTypeHelperParameter(node, b);
        }
      }
    });

    return ast;
  };

  function isInput(node) {
    return node.path.original === 'input';
  }

  function insertTypeHelperParameter(node, builders) {
    var pairs = node.hash.pairs;
    var pair = null;
    for (var i = 0; i < pairs.length; i++) {
      if (pairs[i].key === 'type') {
        pair = pairs[i];
        break;
      }
    }
    if (pair && pair.value.type !== 'StringLiteral') {
      node.params.unshift(builders.sexpr('-input-type', [pair.value], null, pair.loc));
    }
  }
});
enifed('ember-template-compiler/plugins/transform-item-class', ['exports'], function (exports) {
  'use strict';

  exports.default = TransformItemClass;

  function TransformItemClass() {
    this.syntax = null;
  }

  TransformItemClass.prototype.transform = function TransformItemClass_transform(ast) {
    var b = this.syntax.builders;
    var walker = new this.syntax.Walker();

    walker.visit(ast, function (node) {
      if (!validate(node)) {
        return;
      }

      for (var i = 0; i < node.hash.pairs.length; i++) {
        var pair = node.hash.pairs[i];
        var key = pair.key;
        var value = pair.value;

        if (key !== 'itemClass') {
          return;
        }
        if (value.type === 'StringLiteral') {
          return;
        }

        var propName = value.original;
        var params = [value];
        var sexprParams = [b.string(propName), b.path(propName)];

        params.push(b.sexpr(b.string('-normalize-class'), sexprParams));
        var sexpr = b.sexpr(b.string('if'), params);

        pair.value = sexpr;
      }
    });

    return ast;
  };

  function validate(node) {
    return (node.type === 'BlockStatement' || node.type === 'MustacheStatement') && node.path.original === 'collection';
  }
});
enifed('ember-template-compiler/plugins/transform-old-binding-syntax', ['exports', 'ember-metal', 'ember-template-compiler/system/calculate-location-display'], function (exports, _emberMetal, _emberTemplateCompilerSystemCalculateLocationDisplay) {
  'use strict';

  exports.default = TransformOldBindingSyntax;

  function TransformOldBindingSyntax(options) {
    this.syntax = null;
    this.options = options;
  }

  TransformOldBindingSyntax.prototype.transform = function TransformOldBindingSyntax_transform(ast) {
    var moduleName = this.options.meta.moduleName;
    var b = this.syntax.builders;
    var walker = new this.syntax.Walker();

    walker.visit(ast, function (node) {
      if (!validate(node)) {
        return;
      }

      for (var i = 0; i < node.hash.pairs.length; i++) {
        var pair = node.hash.pairs[i];
        var key = pair.key;
        var value = pair.value;

        var sourceInformation = _emberTemplateCompilerSystemCalculateLocationDisplay.default(moduleName, pair.loc);

        if (key === 'classBinding') {
          return;
        }

        _emberMetal.assert('Setting \'attributeBindings\' via template helpers is not allowed ' + sourceInformation, key !== 'attributeBindings');

        if (key.substr(-7) === 'Binding') {
          var newKey = key.slice(0, -7);

          _emberMetal.deprecate('You\'re using legacy binding syntax: ' + key + '=' + exprToString(value) + ' ' + sourceInformation + '. Please replace with ' + newKey + '=' + value.original, false, { id: 'ember-template-compiler.transform-old-binding-syntax', until: '3.0.0' });

          pair.key = newKey;
          if (value.type === 'StringLiteral') {
            pair.value = b.path(value.original);
          }
        }
      }
    });

    return ast;
  };

  function validate(node) {
    return node.type === 'BlockStatement' || node.type === 'MustacheStatement';
  }

  function exprToString(expr) {
    switch (expr.type) {
      case 'StringLiteral':
        return '"' + expr.original + '"';
      case 'PathExpression':
        return expr.original;
    }
  }
});
enifed('ember-template-compiler/plugins/transform-old-class-binding-syntax', ['exports'], function (exports) {
  'use strict';

  exports.default = TransformOldClassBindingSyntax;

  function TransformOldClassBindingSyntax(options) {
    this.syntax = null;
    this.options = options;
  }

  TransformOldClassBindingSyntax.prototype.transform = function TransformOldClassBindingSyntax_transform(ast) {
    var b = this.syntax.builders;
    var walker = new this.syntax.Walker();

    walker.visit(ast, function (node) {
      if (!validate(node)) {
        return;
      }

      var allOfTheMicrosyntaxes = [];
      var allOfTheMicrosyntaxIndexes = [];
      var classPair = undefined;

      each(node.hash.pairs, function (pair, index) {
        var key = pair.key;

        if (key === 'classBinding' || key === 'classNameBindings') {
          allOfTheMicrosyntaxIndexes.push(index);
          allOfTheMicrosyntaxes.push(pair);
        } else if (key === 'class') {
          classPair = pair;
        }
      });

      if (allOfTheMicrosyntaxes.length === 0) {
        return;
      }

      var classValue = [];

      if (classPair) {
        classValue.push(classPair.value);
        classValue.push(b.string(' '));
      } else {
        classPair = b.pair('class', null);
        node.hash.pairs.push(classPair);
      }

      each(allOfTheMicrosyntaxIndexes, function (index) {
        node.hash.pairs.splice(index, 1);
      });

      each(allOfTheMicrosyntaxes, function (_ref) {
        var value = _ref.value;
        var loc = _ref.loc;

        var sexprs = [];
        // TODO: add helpful deprecation when both `classNames` and `classNameBindings` can
        // be removed.

        if (value.type === 'StringLiteral') {
          var microsyntax = parseMicrosyntax(value.original);

          buildSexprs(microsyntax, sexprs, b);

          classValue.push.apply(classValue, sexprs);
        }
      });

      var hash = b.hash();
      classPair.value = b.sexpr(b.path('concat'), classValue, hash);
    });

    return ast;
  };

  function buildSexprs(microsyntax, sexprs, b) {
    for (var i = 0; i < microsyntax.length; i++) {
      var _microsyntax$i = microsyntax[i];
      var propName = _microsyntax$i[0];
      var activeClass = _microsyntax$i[1];
      var inactiveClass = _microsyntax$i[2];

      var sexpr = undefined;

      // :my-class-name microsyntax for static values
      if (propName === '') {
        sexpr = b.string(activeClass);
      } else {
        var params = [b.path(propName)];

        if (activeClass || activeClass === '') {
          params.push(b.string(activeClass));
        } else {
          var sexprParams = [b.string(propName), b.path(propName)];

          var hash = b.hash();
          if (activeClass !== undefined) {
            hash.pairs.push(b.pair('activeClass', b.string(activeClass)));
          }

          if (inactiveClass !== undefined) {
            hash.pairs.push(b.pair('inactiveClass', b.string(inactiveClass)));
          }

          params.push(b.sexpr(b.path('-normalize-class'), sexprParams, hash));
        }

        if (inactiveClass || inactiveClass === '') {
          params.push(b.string(inactiveClass));
        }

        sexpr = b.sexpr(b.path('if'), params);
      }

      sexprs.push(sexpr);
      sexprs.push(b.string(' '));
    }
  }

  function validate(node) {
    return node.type === 'BlockStatement' || node.type === 'MustacheStatement';
  }

  function each(list, callback) {
    for (var i = 0; i < list.length; i++) {
      callback(list[i], i);
    }
  }

  function parseMicrosyntax(string) {
    var segments = string.split(' ');

    for (var i = 0; i < segments.length; i++) {
      segments[i] = segments[i].split(':');
    }

    return segments;
  }
});
enifed('ember-template-compiler/plugins/transform-quoted-bindings-into-just-bindings', ['exports'], function (exports) {
  'use strict';

  exports.default = TransformQuotedBindingsIntoJustBindings;

  function TransformQuotedBindingsIntoJustBindings() {
    // set later within HTMLBars to the syntax package
    this.syntax = null;
  }

  /**
    @private
    @method transform
    @param {AST} ast The AST to be transformed.
  */
  TransformQuotedBindingsIntoJustBindings.prototype.transform = function TransformQuotedBindingsIntoJustBindings_transform(ast) {
    var walker = new this.syntax.Walker();

    walker.visit(ast, function (node) {
      if (!validate(node)) {
        return;
      }

      var styleAttr = getStyleAttr(node);

      if (!validStyleAttr(styleAttr)) {
        return;
      }

      styleAttr.value = styleAttr.value.parts[0];
    });

    return ast;
  };

  function validate(node) {
    return node.type === 'ElementNode';
  }

  function validStyleAttr(attr) {
    if (!attr) {
      return false;
    }

    var value = attr.value;

    if (!value || value.type !== 'ConcatStatement' || value.parts.length !== 1) {
      return false;
    }

    var onlyPart = value.parts[0];

    return onlyPart.type === 'MustacheStatement';
  }

  function getStyleAttr(node) {
    var attributes = node.attributes;

    for (var i = 0; i < attributes.length; i++) {
      if (attributes[i].name === 'style') {
        return attributes[i];
      }
    }
  }
});
enifed('ember-template-compiler/plugins/transform-top-level-components', ['exports'], function (exports) {
  'use strict';

  exports.default = TransformTopLevelComponents;

  function TransformTopLevelComponents() {
    // set later within HTMLBars to the syntax package
    this.syntax = null;
  }

  /**
    @private
    @method transform
    @param {AST} The AST to be transformed.
  */
  TransformTopLevelComponents.prototype.transform = function TransformTopLevelComponents_transform(ast) {
    hasSingleComponentNode(ast, function (component) {
      component.tag = '@' + component.tag;
      component.isStatic = true;
    });

    return ast;
  };

  function hasSingleComponentNode(program, componentCallback) {
    var loc = program.loc;
    var body = program.body;

    if (!loc || loc.start.line !== 1 || loc.start.column !== 0) {
      return;
    }

    var lastComponentNode = undefined;
    var nodeCount = 0;

    for (var i = 0; i < body.length; i++) {
      var curr = body[i];

      // text node with whitespace only
      if (curr.type === 'TextNode' && /^[\s]*$/.test(curr.chars)) {
        continue;
      }

      // has multiple root elements if we've been here before
      if (nodeCount++ > 0) {
        return false;
      }

      if (curr.type === 'ComponentNode' || curr.type === 'ElementNode') {
        lastComponentNode = curr;
      }
    }

    if (!lastComponentNode) {
      return;
    }

    if (lastComponentNode.type === 'ComponentNode') {
      componentCallback(lastComponentNode);
    }
  }
});
enifed('ember-template-compiler/system/bootstrap', ['exports', 'ember-metal', 'ember-template-compiler/system/compile'], function (exports, _emberMetal, _emberTemplateCompilerSystemCompile) {
  /**
  @module ember
  @submodule ember-templates
  */

  'use strict';

  /**
    Find templates stored in the head tag as script tags and make them available
    to `Ember.CoreView` in the global `Ember.TEMPLATES` object.
  
    Script tags with `text/x-handlebars` will be compiled
    with Ember's template compiler and are suitable for use as a view's template.
  
    @private
    @method bootstrap
    @for Ember.HTMLBars
    @static
    @param ctx
  */
  function bootstrap(_ref) {
    var context = _ref.context;
    var hasTemplate = _ref.hasTemplate;
    var setTemplate = _ref.setTemplate;

    if (!context) {
      context = document;
    }

    var selector = 'script[type="text/x-handlebars"]';

    var elements = context.querySelectorAll(selector);

    for (var i = 0; i < elements.length; i++) {
      var script = elements[i];

      // Get the name of the script
      // First look for data-template-name attribute, then fall back to its
      // id if no name is found.
      var templateName = script.getAttribute('data-template-name') || script.getAttribute('id') || 'application';
      var template = undefined;

      template = _emberTemplateCompilerSystemCompile.default(script.innerHTML, {
        moduleName: templateName
      });

      // Check if template of same name already exists.
      if (hasTemplate(templateName)) {
        throw new _emberMetal.Error('Template named "' + templateName + '" already exists.');
      }

      // For templates which have a name, we save them and then remove them from the DOM.
      setTemplate(templateName, template);

      // Remove script tag from DOM.
      script.parentNode.removeChild(script);
    }
  }

  exports.default = bootstrap;
});
enifed('ember-template-compiler/system/calculate-location-display', ['exports'], function (exports) {
  'use strict';

  exports.default = calculateLocationDisplay;

  function calculateLocationDisplay(moduleName) {
    var loc = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    var _ref = loc.start || {};

    var column = _ref.column;
    var line = _ref.line;

    var moduleInfo = '';
    if (moduleName) {
      moduleInfo += '\'' + moduleName + '\' ';
    }

    if (line !== undefined && column !== undefined) {
      if (moduleName) {
        // only prepend @ if the moduleName was present
        moduleInfo += '@ ';
      }
      moduleInfo += 'L' + line + ':C' + column;
    }

    if (moduleInfo) {
      moduleInfo = '(' + moduleInfo + ') ';
    }

    return moduleInfo;
  }
});
enifed('ember-template-compiler/system/compile-options', ['exports', 'ember-utils', 'ember-template-compiler/plugins'], function (exports, _emberUtils, _emberTemplateCompilerPlugins) {
  'use strict';

  exports.default = compileOptions;
  exports.registerPlugin = registerPlugin;
  exports.removePlugin = removePlugin;

  var USER_PLUGINS = [];

  function compileOptions(_options) {
    var options = _emberUtils.assign({ meta: {} }, _options);

    // move `moduleName` into `meta` property
    if (options.moduleName) {
      var meta = options.meta;
      meta.moduleName = options.moduleName;
    }

    if (!options.plugins) {
      options.plugins = { ast: [].concat(USER_PLUGINS, _emberTemplateCompilerPlugins.default) };
    } else {
      var potententialPugins = [].concat(USER_PLUGINS, _emberTemplateCompilerPlugins.default);
      var pluginsToAdd = potententialPugins.filter(function (plugin) {
        return options.plugins.ast.indexOf(plugin) === -1;
      });
      options.plugins.ast = options.plugins.ast.slice().concat(pluginsToAdd);
    }

    return options;
  }

  function registerPlugin(type, PluginClass) {
    if (type !== 'ast') {
      throw new Error('Attempting to register ' + PluginClass + ' as "' + type + '" which is not a valid Glimmer plugin type.');
    }

    if (USER_PLUGINS.indexOf(PluginClass) === -1) {
      USER_PLUGINS = [PluginClass].concat(USER_PLUGINS);
    }
  }

  function removePlugin(type, PluginClass) {
    if (type !== 'ast') {
      throw new Error('Attempting to unregister ' + PluginClass + ' as "' + type + '" which is not a valid Glimmer plugin type.');
    }

    USER_PLUGINS = USER_PLUGINS.filter(function (plugin) {
      return plugin !== PluginClass;
    });
  }
});
enifed('ember-template-compiler/system/compile', ['exports', 'require', 'ember-template-compiler/system/precompile'], function (exports, _require, _emberTemplateCompilerSystemPrecompile) {
  /**
  @module ember
  @submodule ember-template-compiler
  */
  'use strict';

  exports.default = compile;

  var template = undefined;

  /**
    Uses HTMLBars `compile` function to process a string into a compiled template.
  
    This is not present in production builds.
  
    @private
    @method compile
    @param {String} templateString This is the string to be compiled by HTMLBars.
    @param {Object} options This is an options hash to augment the compiler options.
  */

  function compile(templateString, options) {
    if (!template && _require.has('ember-glimmer')) {
      template = _require.default('ember-glimmer').template;
    }

    if (!template) {
      throw new Error('Cannot call `compile` with only the template compiler loaded. Please load `ember.debug.js` or `ember.prod.js` prior to calling `compile`.');
    }

    var precompiledTemplateString = _emberTemplateCompilerSystemPrecompile.default(templateString, options);
    var templateJS = new Function('return ' + precompiledTemplateString)();
    return template(templateJS);
  }
});
enifed('ember-template-compiler/system/precompile', ['exports', 'ember-template-compiler/system/compile-options', 'require'], function (exports, _emberTemplateCompilerSystemCompileOptions, _require) {
  /**
  @module ember
  @submodule ember-template-compiler
  */

  'use strict';

  exports.default = precompile;

  var glimmerPrecompile = undefined;

  /**
    Uses HTMLBars `compile` function to process a string into a compiled template string.
    The returned string must be passed through `Ember.HTMLBars.template`.
  
    This is not present in production builds.
  
    @private
    @method precompile
    @param {String} templateString This is the string to be compiled by HTMLBars.
  */

  function precompile(templateString, options) {
    if (!glimmerPrecompile && _require.has('@glimmer/compiler')) {
      glimmerPrecompile = _require.default('@glimmer/compiler').precompile;
    }

    if (!glimmerPrecompile) {
      throw new Error('Cannot call `compile` without the template compiler loaded. Please load `ember-template-compiler.js` prior to calling `compile`.');
    }

    return glimmerPrecompile(templateString, _emberTemplateCompilerSystemCompileOptions.default(options));
  }
});
enifed("ember-utils/apply-str", ["exports"], function (exports) {
  /**
   @param {Object} t target
   @param {String} m method
   @param {Array} a args
   @private
   */
  "use strict";

  exports.default = applyStr;

  function applyStr(t, m, a) {
    var l = a && a.length;
    if (!a || !l) {
      return t[m]();
    }
    switch (l) {
      case 1:
        return t[m](a[0]);
      case 2:
        return t[m](a[0], a[1]);
      case 3:
        return t[m](a[0], a[1], a[2]);
      case 4:
        return t[m](a[0], a[1], a[2], a[3]);
      case 5:
        return t[m](a[0], a[1], a[2], a[3], a[4]);
      default:
        return t[m].apply(t, a);
    }
  }
});
enifed("ember-utils/assign", ["exports"], function (exports) {
  /**
    Copy properties from a source object to a target object.
  
    ```javascript
    var a = { first: 'Yehuda' };
    var b = { last: 'Katz' };
    var c = { company: 'Tilde Inc.' };
    Ember.assign(a, b, c); // a === { first: 'Yehuda', last: 'Katz', company: 'Tilde Inc.' }, b === { last: 'Katz' }, c === { company: 'Tilde Inc.' }
    ```
  
    @method assign
    @for Ember
    @param {Object} original The object to assign into
    @param {Object} ...args The objects to copy properties from
    @return {Object}
    @public
  */
  "use strict";

  exports.default = assign;

  function assign(original) {
    for (var i = 1; i < arguments.length; i++) {
      var arg = arguments[i];
      if (!arg) {
        continue;
      }

      var updates = Object.keys(arg);

      for (var _i = 0; _i < updates.length; _i++) {
        var prop = updates[_i];
        original[prop] = arg[prop];
      }
    }

    return original;
  }
});
enifed('ember-utils/dictionary', ['exports', 'ember-utils/empty-object'], function (exports, _emberUtilsEmptyObject) {
  'use strict';

  exports.default = makeDictionary;

  // the delete is meant to hint at runtimes that this object should remain in
  // dictionary mode. This is clearly a runtime specific hack, but currently it
  // appears worthwhile in some usecases. Please note, these deletes do increase
  // the cost of creation dramatically over a plain Object.create. And as this
  // only makes sense for long-lived dictionaries that aren't instantiated often.

  function makeDictionary(parent) {
    var dict = undefined;
    if (parent === null) {
      dict = new _emberUtilsEmptyObject.default();
    } else {
      dict = Object.create(parent);
    }
    dict['_dict'] = null;
    delete dict['_dict'];
    return dict;
  }
});
enifed("ember-utils/empty-object", ["exports"], function (exports) {
  // This exists because `Object.create(null)` is absurdly slow compared
  // to `new EmptyObject()`. In either case, you want a null prototype
  // when you're treating the object instances as arbitrary dictionaries
  // and don't want your keys colliding with build-in methods on the
  // default object prototype.

  "use strict";

  var proto = Object.create(null, {
    // without this, we will always still end up with (new
    // EmptyObject()).constructor === Object
    constructor: {
      value: undefined,
      enumerable: false,
      writable: true
    }
  });

  function EmptyObject() {}
  EmptyObject.prototype = proto;
  exports.default = EmptyObject;
});
enifed('ember-utils/guid', ['exports', 'ember-utils/intern'], function (exports, _emberUtilsIntern) {
  'use strict';

  exports.uuid = uuid;
  exports.generateGuid = generateGuid;
  exports.guidFor = guidFor;

  /**
   Previously we used `Ember.$.uuid`, however `$.uuid` has been removed from
   jQuery master. We'll just bootstrap our own uuid now.
  
   @private
   @return {Number} the uuid
   */
  var _uuid = 0;

  /**
   Generates a universally unique identifier. This method
   is used internally by Ember for assisting with
   the generation of GUID's and other unique identifiers.
  
   @public
   @return {Number} [description]
   */

  function uuid() {
    return ++_uuid;
  }

  /**
   Prefix used for guids through out Ember.
   @private
   @property GUID_PREFIX
   @for Ember
   @type String
   @final
   */
  var GUID_PREFIX = 'ember';

  // Used for guid generation...
  var numberCache = [];
  var stringCache = {};

  /**
    A unique key used to assign guids and other private metadata to objects.
    If you inspect an object in your browser debugger you will often see these.
    They can be safely ignored.
  
    On browsers that support it, these properties are added with enumeration
    disabled so they won't show up when you iterate over your properties.
  
    @private
    @property GUID_KEY
    @for Ember
    @type String
    @final
  */
  var GUID_KEY = _emberUtilsIntern.default('__ember' + +new Date());

  exports.GUID_KEY = GUID_KEY;
  var GUID_DESC = {
    writable: true,
    configurable: true,
    enumerable: false,
    value: null
  };

  exports.GUID_DESC = GUID_DESC;
  var nullDescriptor = {
    configurable: true,
    writable: true,
    enumerable: false,
    value: null
  };

  var GUID_KEY_PROPERTY = {
    name: GUID_KEY,
    descriptor: nullDescriptor
  };

  exports.GUID_KEY_PROPERTY = GUID_KEY_PROPERTY;
  /**
    Generates a new guid, optionally saving the guid to the object that you
    pass in. You will rarely need to use this method. Instead you should
    call `Ember.guidFor(obj)`, which return an existing guid if available.
  
    @private
    @method generateGuid
    @for Ember
    @param {Object} [obj] Object the guid will be used for. If passed in, the guid will
      be saved on the object and reused whenever you pass the same object
      again.
  
      If no object is passed, just generate a new guid.
    @param {String} [prefix] Prefix to place in front of the guid. Useful when you want to
      separate the guid into separate namespaces.
    @return {String} the guid
  */

  function generateGuid(obj, prefix) {
    if (!prefix) {
      prefix = GUID_PREFIX;
    }

    var ret = prefix + uuid();
    if (obj) {
      if (obj[GUID_KEY] === null) {
        obj[GUID_KEY] = ret;
      } else {
        GUID_DESC.value = ret;
        if (obj.__defineNonEnumerable) {
          obj.__defineNonEnumerable(GUID_KEY_PROPERTY);
        } else {
          Object.defineProperty(obj, GUID_KEY, GUID_DESC);
        }
      }
    }
    return ret;
  }

  /**
    Returns a unique id for the object. If the object does not yet have a guid,
    one will be assigned to it. You can call this on any object,
    `Ember.Object`-based or not, but be aware that it will add a `_guid`
    property.
  
    You can also use this method on DOM Element objects.
  
    @public
    @method guidFor
    @for Ember
    @param {Object} obj any object, string, number, Element, or primitive
    @return {String} the unique guid for this instance.
  */

  function guidFor(obj) {
    var type = typeof obj;
    var isObject = type === 'object' && obj !== null;
    var isFunction = type === 'function';

    if ((isObject || isFunction) && obj[GUID_KEY]) {
      return obj[GUID_KEY];
    }

    // special cases where we don't want to add a key to object
    if (obj === undefined) {
      return '(undefined)';
    }

    if (obj === null) {
      return '(null)';
    }

    var ret = undefined;

    // Don't allow prototype changes to String etc. to change the guidFor
    switch (type) {
      case 'number':
        ret = numberCache[obj];

        if (!ret) {
          ret = numberCache[obj] = 'nu' + obj;
        }

        return ret;

      case 'string':
        ret = stringCache[obj];

        if (!ret) {
          ret = stringCache[obj] = 'st' + uuid();
        }

        return ret;

      case 'boolean':
        return obj ? '(true)' : '(false)';

      default:
        if (obj === Object) {
          return '(Object)';
        }

        if (obj === Array) {
          return '(Array)';
        }

        ret = GUID_PREFIX + uuid();

        if (obj[GUID_KEY] === null) {
          obj[GUID_KEY] = ret;
        } else {
          GUID_DESC.value = ret;

          if (obj.__defineNonEnumerable) {
            obj.__defineNonEnumerable(GUID_KEY_PROPERTY);
          } else {
            Object.defineProperty(obj, GUID_KEY, GUID_DESC);
          }
        }
        return ret;
    }
  }
});
enifed('ember-utils/index', ['exports', 'ember-utils/symbol', 'ember-utils/owner', 'ember-utils/assign', 'ember-utils/empty-object', 'ember-utils/dictionary', 'ember-utils/guid', 'ember-utils/intern', 'ember-utils/super', 'ember-utils/inspect', 'ember-utils/lookup-descriptor', 'ember-utils/invoke', 'ember-utils/make-array', 'ember-utils/apply-str', 'ember-utils/name', 'ember-utils/to-string', 'ember-utils/weak-map-utils', 'ember-utils/proxy-utils'], function (exports, _emberUtilsSymbol, _emberUtilsOwner, _emberUtilsAssign, _emberUtilsEmptyObject, _emberUtilsDictionary, _emberUtilsGuid, _emberUtilsIntern, _emberUtilsSuper, _emberUtilsInspect, _emberUtilsLookupDescriptor, _emberUtilsInvoke, _emberUtilsMakeArray, _emberUtilsApplyStr, _emberUtilsName, _emberUtilsToString, _emberUtilsWeakMapUtils, _emberUtilsProxyUtils) {
  /*
   This package will be eagerly parsed and should have no dependencies on external
   packages.
  
   It is intended to be used to share utility methods that will be needed
   by every Ember application (and is **not** a dumping ground of useful utilities).
  
   Utility methods that are needed in < 80% of cases should be placed
   elsewhere (so they can be lazily evaluated / parsed).
  */
  'use strict';

  exports.symbol = _emberUtilsSymbol.default;
  exports.getOwner = _emberUtilsOwner.getOwner;
  exports.setOwner = _emberUtilsOwner.setOwner;
  exports.OWNER = _emberUtilsOwner.OWNER;
  exports.assign = _emberUtilsAssign.default;
  exports.EmptyObject = _emberUtilsEmptyObject.default;
  exports.dictionary = _emberUtilsDictionary.default;
  exports.uuid = _emberUtilsGuid.uuid;
  exports.GUID_KEY = _emberUtilsGuid.GUID_KEY;
  exports.GUID_DESC = _emberUtilsGuid.GUID_DESC;
  exports.GUID_KEY_PROPERTY = _emberUtilsGuid.GUID_KEY_PROPERTY;
  exports.generateGuid = _emberUtilsGuid.generateGuid;
  exports.guidFor = _emberUtilsGuid.guidFor;
  exports.intern = _emberUtilsIntern.default;
  exports.checkHasSuper = _emberUtilsSuper.checkHasSuper;
  exports.ROOT = _emberUtilsSuper.ROOT;
  exports.wrap = _emberUtilsSuper.wrap;
  exports.inspect = _emberUtilsInspect.default;
  exports.lookupDescriptor = _emberUtilsLookupDescriptor.default;
  exports.canInvoke = _emberUtilsInvoke.canInvoke;
  exports.tryInvoke = _emberUtilsInvoke.tryInvoke;
  exports.makeArray = _emberUtilsMakeArray.default;
  exports.applyStr = _emberUtilsApplyStr.default;
  exports.NAME_KEY = _emberUtilsName.default;
  exports.toString = _emberUtilsToString.default;
  exports.HAS_NATIVE_WEAKMAP = _emberUtilsWeakMapUtils.HAS_NATIVE_WEAKMAP;
  exports.HAS_NATIVE_PROXY = _emberUtilsProxyUtils.HAS_NATIVE_PROXY;
});
enifed('ember-utils/inspect', ['exports'], function (exports) {
  'use strict';

  exports.default = inspect;
  var objectToString = Object.prototype.toString;

  /**
    Convenience method to inspect an object. This method will attempt to
    convert the object into a useful string description.
  
    It is a pretty simple implementation. If you want something more robust,
    use something like JSDump: https://github.com/NV/jsDump
  
    @method inspect
    @for Ember
    @param {Object} obj The object you want to inspect.
    @return {String} A description of the object
    @since 1.4.0
    @private
  */

  function inspect(obj) {
    if (obj === null) {
      return 'null';
    }
    if (obj === undefined) {
      return 'undefined';
    }
    if (Array.isArray(obj)) {
      return '[' + obj + ']';
    }
    // for non objects
    var type = typeof obj;
    if (type !== 'object' && type !== 'symbol') {
      return '' + obj;
    }
    // overridden toString
    if (typeof obj.toString === 'function' && obj.toString !== objectToString) {
      return obj.toString();
    }

    // Object.prototype.toString === {}.toString
    var v = undefined;
    var ret = [];
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        v = obj[key];
        if (v === 'toString') {
          continue;
        } // ignore useless items
        if (typeof v === 'function') {
          v = 'function() { ... }';
        }

        if (v && typeof v.toString !== 'function') {
          ret.push(key + ': ' + objectToString.call(v));
        } else {
          ret.push(key + ': ' + v);
        }
      }
    }
    return '{' + ret.join(', ') + '}';
  }
});
enifed("ember-utils/intern", ["exports"], function (exports) {
  /**
    Strongly hint runtimes to intern the provided string.
  
    When do I need to use this function?
  
    For the most part, never. Pre-mature optimization is bad, and often the
    runtime does exactly what you need it to, and more often the trade-off isn't
    worth it.
  
    Why?
  
    Runtimes store strings in at least 2 different representations:
    Ropes and Symbols (interned strings). The Rope provides a memory efficient
    data-structure for strings created from concatenation or some other string
    manipulation like splitting.
  
    Unfortunately checking equality of different ropes can be quite costly as
    runtimes must resort to clever string comparison algorithms. These
    algorithms typically cost in proportion to the length of the string.
    Luckily, this is where the Symbols (interned strings) shine. As Symbols are
    unique by their string content, equality checks can be done by pointer
    comparison.
  
    How do I know if my string is a rope or symbol?
  
    Typically (warning general sweeping statement, but truthy in runtimes at
    present) static strings created as part of the JS source are interned.
    Strings often used for comparisons can be interned at runtime if some
    criteria are met.  One of these criteria can be the size of the entire rope.
    For example, in chrome 38 a rope longer then 12 characters will not
    intern, nor will segments of that rope.
  
    Some numbers: http://jsperf.com/eval-vs-keys/8
  
    Known Trick™
  
    @private
    @return {String} interned version of the provided string
  */
  "use strict";

  exports.default = intern;

  function intern(str) {
    var obj = {};
    obj[str] = 1;
    for (var key in obj) {
      if (key === str) {
        return key;
      }
    }
    return str;
  }
});
enifed('ember-utils/invoke', ['exports', 'ember-utils/apply-str'], function (exports, _emberUtilsApplyStr) {
  'use strict';

  exports.canInvoke = canInvoke;
  exports.tryInvoke = tryInvoke;

  /**
    Checks to see if the `methodName` exists on the `obj`.
  
    ```javascript
    let foo = { bar: function() { return 'bar'; }, baz: null };
  
    Ember.canInvoke(foo, 'bar'); // true
    Ember.canInvoke(foo, 'baz'); // false
    Ember.canInvoke(foo, 'bat'); // false
    ```
  
    @method canInvoke
    @for Ember
    @param {Object} obj The object to check for the method
    @param {String} methodName The method name to check for
    @return {Boolean}
    @private
  */

  function canInvoke(obj, methodName) {
    return !!(obj && typeof obj[methodName] === 'function');
  }

  /**
    Checks to see if the `methodName` exists on the `obj`,
    and if it does, invokes it with the arguments passed.
  
    ```javascript
    let d = new Date('03/15/2013');
  
    Ember.tryInvoke(d, 'getTime');              // 1363320000000
    Ember.tryInvoke(d, 'setFullYear', [2014]);  // 1394856000000
    Ember.tryInvoke(d, 'noSuchMethod', [2014]); // undefined
    ```
  
    @method tryInvoke
    @for Ember
    @param {Object} obj The object to check for the method
    @param {String} methodName The method name to check for
    @param {Array} [args] The arguments to pass to the method
    @return {*} the return value of the invoked method or undefined if it cannot be invoked
    @public
  */

  function tryInvoke(obj, methodName, args) {
    if (canInvoke(obj, methodName)) {
      return args ? _emberUtilsApplyStr.default(obj, methodName, args) : _emberUtilsApplyStr.default(obj, methodName);
    }
  }
});
enifed("ember-utils/lookup-descriptor", ["exports"], function (exports) {
  "use strict";

  exports.default = lookupDescriptor;

  function lookupDescriptor(obj, keyName) {
    var current = obj;
    while (current) {
      var descriptor = Object.getOwnPropertyDescriptor(current, keyName);

      if (descriptor) {
        return descriptor;
      }

      current = Object.getPrototypeOf(current);
    }

    return null;
  }
});
enifed("ember-utils/make-array", ["exports"], function (exports) {
  "use strict";

  exports.default = makeArray;
  var isArray = Array.isArray;

  /**
   Forces the passed object to be part of an array. If the object is already
   an array, it will return the object. Otherwise, it will add the object to
   an array. If obj is `null` or `undefined`, it will return an empty array.
  
   ```javascript
   Ember.makeArray();            // []
   Ember.makeArray(null);        // []
   Ember.makeArray(undefined);   // []
   Ember.makeArray('lindsay');   // ['lindsay']
   Ember.makeArray([1, 2, 42]);  // [1, 2, 42]
  
   let controller = Ember.ArrayProxy.create({ content: [] });
  
   Ember.makeArray(controller) === controller;  // true
   ```
  
   @method makeArray
   @for Ember
   @param {Object} obj the object
   @return {Array}
   @private
   */

  function makeArray(obj) {
    if (obj === null || obj === undefined) {
      return [];
    }
    return isArray(obj) ? obj : [obj];
  }
});
enifed('ember-utils/name', ['exports', 'ember-utils/symbol'], function (exports, _emberUtilsSymbol) {
  'use strict';

  exports.default = _emberUtilsSymbol.default('NAME_KEY');
});
enifed('ember-utils/owner', ['exports', 'ember-utils/symbol'], function (exports, _emberUtilsSymbol) {
  /**
  @module ember
  @submodule ember-runtime
  */

  'use strict';

  exports.getOwner = getOwner;
  exports.setOwner = setOwner;
  var OWNER = _emberUtilsSymbol.default('OWNER');

  exports.OWNER = OWNER;
  /**
    Framework objects in an Ember application (components, services, routes, etc.)
    are created via a factory and dependency injection system. Each of these
    objects is the responsibility of an "owner", which handled its
    instantiation and manages its lifetime.
  
    `getOwner` fetches the owner object responsible for an instance. This can
    be used to lookup or resolve other class instances, or register new factories
    into the owner.
  
    For example, this component dynamically looks up a service based on the
    `audioType` passed as an attribute:
  
    ```
    // app/components/play-audio.js
    import Ember from 'ember';
  
    // Usage:
    //
    //   {{play-audio audioType=model.audioType audioFile=model.file}}
    //
    export default Ember.Component.extend({
      audioService: Ember.computed('audioType', function() {
        let owner = Ember.getOwner(this);
        return owner.lookup(`service:${this.get('audioType')}`);
      }),
      click() {
        let player = this.get('audioService');
        player.play(this.get('audioFile'));
      }
    });
    ```
  
    @method getOwner
    @for Ember
    @param {Object} object An object with an owner.
    @return {Object} An owner object.
    @since 2.3.0
    @public
  */

  function getOwner(object) {
    return object[OWNER];
  }

  /**
    `setOwner` forces a new owner on a given object instance. This is primarily
    useful in some testing cases.
  
    @method setOwner
    @for Ember
    @param {Object} object An object instance.
    @param {Object} object The new owner object of the object instance.
    @since 2.3.0
    @public
  */

  function setOwner(object, owner) {
    object[OWNER] = owner;
  }
});
enifed('ember-utils/proxy-utils', ['exports'], function (exports) {
  'use strict';

  var HAS_NATIVE_PROXY = typeof Proxy === 'function';
  exports.HAS_NATIVE_PROXY = HAS_NATIVE_PROXY;
});
enifed('ember-utils/super', ['exports'], function (exports) {
  'use strict';

  exports.wrap = wrap;
  var HAS_SUPER_PATTERN = /\.(_super|call\(this|apply\(this)/;
  var fnToString = Function.prototype.toString;

  var checkHasSuper = (function () {
    var sourceAvailable = fnToString.call(function () {
      return this;
    }).indexOf('return this') > -1;

    if (sourceAvailable) {
      return function checkHasSuper(func) {
        return HAS_SUPER_PATTERN.test(fnToString.call(func));
      };
    }

    return function checkHasSuper() {
      return true;
    };
  })();

  exports.checkHasSuper = checkHasSuper;
  function ROOT() {}
  ROOT.__hasSuper = false;

  function hasSuper(func) {
    if (func.__hasSuper === undefined) {
      func.__hasSuper = checkHasSuper(func);
    }
    return func.__hasSuper;
  }

  /**
    Wraps the passed function so that `this._super` will point to the superFunc
    when the function is invoked. This is the primitive we use to implement
    calls to super.
  
    @private
    @method wrap
    @for Ember
    @param {Function} func The function to call
    @param {Function} superFunc The super function.
    @return {Function} wrapped function.
  */

  function wrap(func, superFunc) {
    if (!hasSuper(func)) {
      return func;
    }
    // ensure an unwrapped super that calls _super is wrapped with a terminal _super
    if (!superFunc.wrappedFunction && hasSuper(superFunc)) {
      return _wrap(func, _wrap(superFunc, ROOT));
    }
    return _wrap(func, superFunc);
  }

  function _wrap(func, superFunc) {
    function superWrapper() {
      var orig = this._super;
      this._super = superFunc;
      var ret = func.apply(this, arguments);
      this._super = orig;
      return ret;
    }

    superWrapper.wrappedFunction = func;
    superWrapper.__ember_observes__ = func.__ember_observes__;
    superWrapper.__ember_observesBefore__ = func.__ember_observesBefore__;
    superWrapper.__ember_listens__ = func.__ember_listens__;

    return superWrapper;
  }
});
enifed('ember-utils/symbol', ['exports', 'ember-utils/guid', 'ember-utils/intern'], function (exports, _emberUtilsGuid, _emberUtilsIntern) {
  'use strict';

  exports.default = symbol;

  function symbol(debugName) {
    // TODO: Investigate using platform symbols, but we do not
    // want to require non-enumerability for this API, which
    // would introduce a large cost.
    var id = _emberUtilsGuid.GUID_KEY + Math.floor(Math.random() * new Date());
    return _emberUtilsIntern.default('__' + debugName + '__ [id=' + id + ']');
  }
});
enifed('ember-utils/to-string', ['exports'], function (exports) {
  'use strict';

  exports.default = toString;
  var objectToString = Object.prototype.toString;

  /*
   A `toString` util function that supports objects without a `toString`
   method, e.g. an object created with `Object.create(null)`.
  */

  function toString(obj) {
    if (obj && typeof obj.toString === 'function') {
      return obj.toString();
    } else {
      return objectToString.call(obj);
    }
  }
});
enifed('ember-utils/weak-map-utils', ['exports'], function (exports) {
  'use strict';

  var HAS_NATIVE_WEAKMAP = (function () {
    // detect if `WeakMap` is even present
    var hasWeakMap = typeof WeakMap === 'function';
    if (!hasWeakMap) {
      return false;
    }

    var instance = new WeakMap();
    // use `Object`'s `.toString` directly to prevent us from detecting
    // polyfills as native weakmaps
    return Object.prototype.toString.call(instance) === '[object WeakMap]';
  })();
  exports.HAS_NATIVE_WEAKMAP = HAS_NATIVE_WEAKMAP;
});
enifed("ember/features", ["exports"], function (exports) {
  "use strict";

  exports.default = { "features-stripped-test": null, "ember-libraries-isregistered": null, "ember-improved-instrumentation": null, "ember-metal-weakmap": null, "ember-glimmer-allow-backtracking-rerender": false, "ember-testing-resume-test": null, "ember-factory-for": true, "ember-no-double-extend": true, "ember-routing-router-service": null, "ember-unique-location-history-state": null, "mandatory-setter": true, "ember-glimmer-detect-backtracking-rerender": true };
});
enifed("ember/version", ["exports"], function (exports) {
  "use strict";

  exports.default = "2.13.0-alpha.1-canary+76698a45";
});
enifed("handlebars", ["exports"], function (exports) {
  /* istanbul ignore next */
  /* Jison generated parser */
  "use strict";

  var handlebars = (function () {
    var parser = { trace: function trace() {},
      yy: {},
      symbols_: { "error": 2, "root": 3, "program": 4, "EOF": 5, "program_repetition0": 6, "statement": 7, "mustache": 8, "block": 9, "rawBlock": 10, "partial": 11, "content": 12, "COMMENT": 13, "CONTENT": 14, "openRawBlock": 15, "END_RAW_BLOCK": 16, "OPEN_RAW_BLOCK": 17, "helperName": 18, "openRawBlock_repetition0": 19, "openRawBlock_option0": 20, "CLOSE_RAW_BLOCK": 21, "openBlock": 22, "block_option0": 23, "closeBlock": 24, "openInverse": 25, "block_option1": 26, "OPEN_BLOCK": 27, "openBlock_repetition0": 28, "openBlock_option0": 29, "openBlock_option1": 30, "CLOSE": 31, "OPEN_INVERSE": 32, "openInverse_repetition0": 33, "openInverse_option0": 34, "openInverse_option1": 35, "openInverseChain": 36, "OPEN_INVERSE_CHAIN": 37, "openInverseChain_repetition0": 38, "openInverseChain_option0": 39, "openInverseChain_option1": 40, "inverseAndProgram": 41, "INVERSE": 42, "inverseChain": 43, "inverseChain_option0": 44, "OPEN_ENDBLOCK": 45, "OPEN": 46, "mustache_repetition0": 47, "mustache_option0": 48, "OPEN_UNESCAPED": 49, "mustache_repetition1": 50, "mustache_option1": 51, "CLOSE_UNESCAPED": 52, "OPEN_PARTIAL": 53, "partialName": 54, "partial_repetition0": 55, "partial_option0": 56, "param": 57, "sexpr": 58, "OPEN_SEXPR": 59, "sexpr_repetition0": 60, "sexpr_option0": 61, "CLOSE_SEXPR": 62, "hash": 63, "hash_repetition_plus0": 64, "hashSegment": 65, "ID": 66, "EQUALS": 67, "blockParams": 68, "OPEN_BLOCK_PARAMS": 69, "blockParams_repetition_plus0": 70, "CLOSE_BLOCK_PARAMS": 71, "path": 72, "dataName": 73, "STRING": 74, "NUMBER": 75, "BOOLEAN": 76, "UNDEFINED": 77, "NULL": 78, "DATA": 79, "pathSegments": 80, "SEP": 81, "$accept": 0, "$end": 1 },
      terminals_: { 2: "error", 5: "EOF", 13: "COMMENT", 14: "CONTENT", 16: "END_RAW_BLOCK", 17: "OPEN_RAW_BLOCK", 21: "CLOSE_RAW_BLOCK", 27: "OPEN_BLOCK", 31: "CLOSE", 32: "OPEN_INVERSE", 37: "OPEN_INVERSE_CHAIN", 42: "INVERSE", 45: "OPEN_ENDBLOCK", 46: "OPEN", 49: "OPEN_UNESCAPED", 52: "CLOSE_UNESCAPED", 53: "OPEN_PARTIAL", 59: "OPEN_SEXPR", 62: "CLOSE_SEXPR", 66: "ID", 67: "EQUALS", 69: "OPEN_BLOCK_PARAMS", 71: "CLOSE_BLOCK_PARAMS", 74: "STRING", 75: "NUMBER", 76: "BOOLEAN", 77: "UNDEFINED", 78: "NULL", 79: "DATA", 81: "SEP" },
      productions_: [0, [3, 2], [4, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [12, 1], [10, 3], [15, 5], [9, 4], [9, 4], [22, 6], [25, 6], [36, 6], [41, 2], [43, 3], [43, 1], [24, 3], [8, 5], [8, 5], [11, 5], [57, 1], [57, 1], [58, 5], [63, 1], [65, 3], [68, 3], [18, 1], [18, 1], [18, 1], [18, 1], [18, 1], [18, 1], [18, 1], [54, 1], [54, 1], [73, 2], [72, 1], [80, 3], [80, 1], [6, 0], [6, 2], [19, 0], [19, 2], [20, 0], [20, 1], [23, 0], [23, 1], [26, 0], [26, 1], [28, 0], [28, 2], [29, 0], [29, 1], [30, 0], [30, 1], [33, 0], [33, 2], [34, 0], [34, 1], [35, 0], [35, 1], [38, 0], [38, 2], [39, 0], [39, 1], [40, 0], [40, 1], [44, 0], [44, 1], [47, 0], [47, 2], [48, 0], [48, 1], [50, 0], [50, 2], [51, 0], [51, 1], [55, 0], [55, 2], [56, 0], [56, 1], [60, 0], [60, 2], [61, 0], [61, 1], [64, 1], [64, 2], [70, 1], [70, 2]],
      performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$) {

        var $0 = $$.length - 1;
        switch (yystate) {
          case 1:
            return $$[$0 - 1];
            break;
          case 2:
            this.$ = new yy.Program($$[$0], null, {}, yy.locInfo(this._$));
            break;
          case 3:
            this.$ = $$[$0];
            break;
          case 4:
            this.$ = $$[$0];
            break;
          case 5:
            this.$ = $$[$0];
            break;
          case 6:
            this.$ = $$[$0];
            break;
          case 7:
            this.$ = $$[$0];
            break;
          case 8:
            this.$ = new yy.CommentStatement(yy.stripComment($$[$0]), yy.stripFlags($$[$0], $$[$0]), yy.locInfo(this._$));
            break;
          case 9:
            this.$ = new yy.ContentStatement($$[$0], yy.locInfo(this._$));
            break;
          case 10:
            this.$ = yy.prepareRawBlock($$[$0 - 2], $$[$0 - 1], $$[$0], this._$);
            break;
          case 11:
            this.$ = { path: $$[$0 - 3], params: $$[$0 - 2], hash: $$[$0 - 1] };
            break;
          case 12:
            this.$ = yy.prepareBlock($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], $$[$0], false, this._$);
            break;
          case 13:
            this.$ = yy.prepareBlock($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], $$[$0], true, this._$);
            break;
          case 14:
            this.$ = { path: $$[$0 - 4], params: $$[$0 - 3], hash: $$[$0 - 2], blockParams: $$[$0 - 1], strip: yy.stripFlags($$[$0 - 5], $$[$0]) };
            break;
          case 15:
            this.$ = { path: $$[$0 - 4], params: $$[$0 - 3], hash: $$[$0 - 2], blockParams: $$[$0 - 1], strip: yy.stripFlags($$[$0 - 5], $$[$0]) };
            break;
          case 16:
            this.$ = { path: $$[$0 - 4], params: $$[$0 - 3], hash: $$[$0 - 2], blockParams: $$[$0 - 1], strip: yy.stripFlags($$[$0 - 5], $$[$0]) };
            break;
          case 17:
            this.$ = { strip: yy.stripFlags($$[$0 - 1], $$[$0 - 1]), program: $$[$0] };
            break;
          case 18:
            var inverse = yy.prepareBlock($$[$0 - 2], $$[$0 - 1], $$[$0], $$[$0], false, this._$),
                program = new yy.Program([inverse], null, {}, yy.locInfo(this._$));
            program.chained = true;

            this.$ = { strip: $$[$0 - 2].strip, program: program, chain: true };

            break;
          case 19:
            this.$ = $$[$0];
            break;
          case 20:
            this.$ = { path: $$[$0 - 1], strip: yy.stripFlags($$[$0 - 2], $$[$0]) };
            break;
          case 21:
            this.$ = yy.prepareMustache($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], $$[$0 - 4], yy.stripFlags($$[$0 - 4], $$[$0]), this._$);
            break;
          case 22:
            this.$ = yy.prepareMustache($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], $$[$0 - 4], yy.stripFlags($$[$0 - 4], $$[$0]), this._$);
            break;
          case 23:
            this.$ = new yy.PartialStatement($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], yy.stripFlags($$[$0 - 4], $$[$0]), yy.locInfo(this._$));
            break;
          case 24:
            this.$ = $$[$0];
            break;
          case 25:
            this.$ = $$[$0];
            break;
          case 26:
            this.$ = new yy.SubExpression($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], yy.locInfo(this._$));
            break;
          case 27:
            this.$ = new yy.Hash($$[$0], yy.locInfo(this._$));
            break;
          case 28:
            this.$ = new yy.HashPair(yy.id($$[$0 - 2]), $$[$0], yy.locInfo(this._$));
            break;
          case 29:
            this.$ = yy.id($$[$0 - 1]);
            break;
          case 30:
            this.$ = $$[$0];
            break;
          case 31:
            this.$ = $$[$0];
            break;
          case 32:
            this.$ = new yy.StringLiteral($$[$0], yy.locInfo(this._$));
            break;
          case 33:
            this.$ = new yy.NumberLiteral($$[$0], yy.locInfo(this._$));
            break;
          case 34:
            this.$ = new yy.BooleanLiteral($$[$0], yy.locInfo(this._$));
            break;
          case 35:
            this.$ = new yy.UndefinedLiteral(yy.locInfo(this._$));
            break;
          case 36:
            this.$ = new yy.NullLiteral(yy.locInfo(this._$));
            break;
          case 37:
            this.$ = $$[$0];
            break;
          case 38:
            this.$ = $$[$0];
            break;
          case 39:
            this.$ = yy.preparePath(true, $$[$0], this._$);
            break;
          case 40:
            this.$ = yy.preparePath(false, $$[$0], this._$);
            break;
          case 41:
            $$[$0 - 2].push({ part: yy.id($$[$0]), original: $$[$0], separator: $$[$0 - 1] });this.$ = $$[$0 - 2];
            break;
          case 42:
            this.$ = [{ part: yy.id($$[$0]), original: $$[$0] }];
            break;
          case 43:
            this.$ = [];
            break;
          case 44:
            $$[$0 - 1].push($$[$0]);
            break;
          case 45:
            this.$ = [];
            break;
          case 46:
            $$[$0 - 1].push($$[$0]);
            break;
          case 53:
            this.$ = [];
            break;
          case 54:
            $$[$0 - 1].push($$[$0]);
            break;
          case 59:
            this.$ = [];
            break;
          case 60:
            $$[$0 - 1].push($$[$0]);
            break;
          case 65:
            this.$ = [];
            break;
          case 66:
            $$[$0 - 1].push($$[$0]);
            break;
          case 73:
            this.$ = [];
            break;
          case 74:
            $$[$0 - 1].push($$[$0]);
            break;
          case 77:
            this.$ = [];
            break;
          case 78:
            $$[$0 - 1].push($$[$0]);
            break;
          case 81:
            this.$ = [];
            break;
          case 82:
            $$[$0 - 1].push($$[$0]);
            break;
          case 85:
            this.$ = [];
            break;
          case 86:
            $$[$0 - 1].push($$[$0]);
            break;
          case 89:
            this.$ = [$$[$0]];
            break;
          case 90:
            $$[$0 - 1].push($$[$0]);
            break;
          case 91:
            this.$ = [$$[$0]];
            break;
          case 92:
            $$[$0 - 1].push($$[$0]);
            break;
        }
      },
      table: [{ 3: 1, 4: 2, 5: [2, 43], 6: 3, 13: [2, 43], 14: [2, 43], 17: [2, 43], 27: [2, 43], 32: [2, 43], 46: [2, 43], 49: [2, 43], 53: [2, 43] }, { 1: [3] }, { 5: [1, 4] }, { 5: [2, 2], 7: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 13: [1, 11], 14: [1, 18], 15: 16, 17: [1, 21], 22: 14, 25: 15, 27: [1, 19], 32: [1, 20], 37: [2, 2], 42: [2, 2], 45: [2, 2], 46: [1, 12], 49: [1, 13], 53: [1, 17] }, { 1: [2, 1] }, { 5: [2, 44], 13: [2, 44], 14: [2, 44], 17: [2, 44], 27: [2, 44], 32: [2, 44], 37: [2, 44], 42: [2, 44], 45: [2, 44], 46: [2, 44], 49: [2, 44], 53: [2, 44] }, { 5: [2, 3], 13: [2, 3], 14: [2, 3], 17: [2, 3], 27: [2, 3], 32: [2, 3], 37: [2, 3], 42: [2, 3], 45: [2, 3], 46: [2, 3], 49: [2, 3], 53: [2, 3] }, { 5: [2, 4], 13: [2, 4], 14: [2, 4], 17: [2, 4], 27: [2, 4], 32: [2, 4], 37: [2, 4], 42: [2, 4], 45: [2, 4], 46: [2, 4], 49: [2, 4], 53: [2, 4] }, { 5: [2, 5], 13: [2, 5], 14: [2, 5], 17: [2, 5], 27: [2, 5], 32: [2, 5], 37: [2, 5], 42: [2, 5], 45: [2, 5], 46: [2, 5], 49: [2, 5], 53: [2, 5] }, { 5: [2, 6], 13: [2, 6], 14: [2, 6], 17: [2, 6], 27: [2, 6], 32: [2, 6], 37: [2, 6], 42: [2, 6], 45: [2, 6], 46: [2, 6], 49: [2, 6], 53: [2, 6] }, { 5: [2, 7], 13: [2, 7], 14: [2, 7], 17: [2, 7], 27: [2, 7], 32: [2, 7], 37: [2, 7], 42: [2, 7], 45: [2, 7], 46: [2, 7], 49: [2, 7], 53: [2, 7] }, { 5: [2, 8], 13: [2, 8], 14: [2, 8], 17: [2, 8], 27: [2, 8], 32: [2, 8], 37: [2, 8], 42: [2, 8], 45: [2, 8], 46: [2, 8], 49: [2, 8], 53: [2, 8] }, { 18: 22, 66: [1, 32], 72: 23, 73: 24, 74: [1, 25], 75: [1, 26], 76: [1, 27], 77: [1, 28], 78: [1, 29], 79: [1, 31], 80: 30 }, { 18: 33, 66: [1, 32], 72: 23, 73: 24, 74: [1, 25], 75: [1, 26], 76: [1, 27], 77: [1, 28], 78: [1, 29], 79: [1, 31], 80: 30 }, { 4: 34, 6: 3, 13: [2, 43], 14: [2, 43], 17: [2, 43], 27: [2, 43], 32: [2, 43], 37: [2, 43], 42: [2, 43], 45: [2, 43], 46: [2, 43], 49: [2, 43], 53: [2, 43] }, { 4: 35, 6: 3, 13: [2, 43], 14: [2, 43], 17: [2, 43], 27: [2, 43], 32: [2, 43], 42: [2, 43], 45: [2, 43], 46: [2, 43], 49: [2, 43], 53: [2, 43] }, { 12: 36, 14: [1, 18] }, { 18: 38, 54: 37, 58: 39, 59: [1, 40], 66: [1, 32], 72: 23, 73: 24, 74: [1, 25], 75: [1, 26], 76: [1, 27], 77: [1, 28], 78: [1, 29], 79: [1, 31], 80: 30 }, { 5: [2, 9], 13: [2, 9], 14: [2, 9], 16: [2, 9], 17: [2, 9], 27: [2, 9], 32: [2, 9], 37: [2, 9], 42: [2, 9], 45: [2, 9], 46: [2, 9], 49: [2, 9], 53: [2, 9] }, { 18: 41, 66: [1, 32], 72: 23, 73: 24, 74: [1, 25], 75: [1, 26], 76: [1, 27], 77: [1, 28], 78: [1, 29], 79: [1, 31], 80: 30 }, { 18: 42, 66: [1, 32], 72: 23, 73: 24, 74: [1, 25], 75: [1, 26], 76: [1, 27], 77: [1, 28], 78: [1, 29], 79: [1, 31], 80: 30 }, { 18: 43, 66: [1, 32], 72: 23, 73: 24, 74: [1, 25], 75: [1, 26], 76: [1, 27], 77: [1, 28], 78: [1, 29], 79: [1, 31], 80: 30 }, { 31: [2, 73], 47: 44, 59: [2, 73], 66: [2, 73], 74: [2, 73], 75: [2, 73], 76: [2, 73], 77: [2, 73], 78: [2, 73], 79: [2, 73] }, { 21: [2, 30], 31: [2, 30], 52: [2, 30], 59: [2, 30], 62: [2, 30], 66: [2, 30], 69: [2, 30], 74: [2, 30], 75: [2, 30], 76: [2, 30], 77: [2, 30], 78: [2, 30], 79: [2, 30] }, { 21: [2, 31], 31: [2, 31], 52: [2, 31], 59: [2, 31], 62: [2, 31], 66: [2, 31], 69: [2, 31], 74: [2, 31], 75: [2, 31], 76: [2, 31], 77: [2, 31], 78: [2, 31], 79: [2, 31] }, { 21: [2, 32], 31: [2, 32], 52: [2, 32], 59: [2, 32], 62: [2, 32], 66: [2, 32], 69: [2, 32], 74: [2, 32], 75: [2, 32], 76: [2, 32], 77: [2, 32], 78: [2, 32], 79: [2, 32] }, { 21: [2, 33], 31: [2, 33], 52: [2, 33], 59: [2, 33], 62: [2, 33], 66: [2, 33], 69: [2, 33], 74: [2, 33], 75: [2, 33], 76: [2, 33], 77: [2, 33], 78: [2, 33], 79: [2, 33] }, { 21: [2, 34], 31: [2, 34], 52: [2, 34], 59: [2, 34], 62: [2, 34], 66: [2, 34], 69: [2, 34], 74: [2, 34], 75: [2, 34], 76: [2, 34], 77: [2, 34], 78: [2, 34], 79: [2, 34] }, { 21: [2, 35], 31: [2, 35], 52: [2, 35], 59: [2, 35], 62: [2, 35], 66: [2, 35], 69: [2, 35], 74: [2, 35], 75: [2, 35], 76: [2, 35], 77: [2, 35], 78: [2, 35], 79: [2, 35] }, { 21: [2, 36], 31: [2, 36], 52: [2, 36], 59: [2, 36], 62: [2, 36], 66: [2, 36], 69: [2, 36], 74: [2, 36], 75: [2, 36], 76: [2, 36], 77: [2, 36], 78: [2, 36], 79: [2, 36] }, { 21: [2, 40], 31: [2, 40], 52: [2, 40], 59: [2, 40], 62: [2, 40], 66: [2, 40], 69: [2, 40], 74: [2, 40], 75: [2, 40], 76: [2, 40], 77: [2, 40], 78: [2, 40], 79: [2, 40], 81: [1, 45] }, { 66: [1, 32], 80: 46 }, { 21: [2, 42], 31: [2, 42], 52: [2, 42], 59: [2, 42], 62: [2, 42], 66: [2, 42], 69: [2, 42], 74: [2, 42], 75: [2, 42], 76: [2, 42], 77: [2, 42], 78: [2, 42], 79: [2, 42], 81: [2, 42] }, { 50: 47, 52: [2, 77], 59: [2, 77], 66: [2, 77], 74: [2, 77], 75: [2, 77], 76: [2, 77], 77: [2, 77], 78: [2, 77], 79: [2, 77] }, { 23: 48, 36: 50, 37: [1, 52], 41: 51, 42: [1, 53], 43: 49, 45: [2, 49] }, { 26: 54, 41: 55, 42: [1, 53], 45: [2, 51] }, { 16: [1, 56] }, { 31: [2, 81], 55: 57, 59: [2, 81], 66: [2, 81], 74: [2, 81], 75: [2, 81], 76: [2, 81], 77: [2, 81], 78: [2, 81], 79: [2, 81] }, { 31: [2, 37], 59: [2, 37], 66: [2, 37], 74: [2, 37], 75: [2, 37], 76: [2, 37], 77: [2, 37], 78: [2, 37], 79: [2, 37] }, { 31: [2, 38], 59: [2, 38], 66: [2, 38], 74: [2, 38], 75: [2, 38], 76: [2, 38], 77: [2, 38], 78: [2, 38], 79: [2, 38] }, { 18: 58, 66: [1, 32], 72: 23, 73: 24, 74: [1, 25], 75: [1, 26], 76: [1, 27], 77: [1, 28], 78: [1, 29], 79: [1, 31], 80: 30 }, { 28: 59, 31: [2, 53], 59: [2, 53], 66: [2, 53], 69: [2, 53], 74: [2, 53], 75: [2, 53], 76: [2, 53], 77: [2, 53], 78: [2, 53], 79: [2, 53] }, { 31: [2, 59], 33: 60, 59: [2, 59], 66: [2, 59], 69: [2, 59], 74: [2, 59], 75: [2, 59], 76: [2, 59], 77: [2, 59], 78: [2, 59], 79: [2, 59] }, { 19: 61, 21: [2, 45], 59: [2, 45], 66: [2, 45], 74: [2, 45], 75: [2, 45], 76: [2, 45], 77: [2, 45], 78: [2, 45], 79: [2, 45] }, { 18: 65, 31: [2, 75], 48: 62, 57: 63, 58: 66, 59: [1, 40], 63: 64, 64: 67, 65: 68, 66: [1, 69], 72: 23, 73: 24, 74: [1, 25], 75: [1, 26], 76: [1, 27], 77: [1, 28], 78: [1, 29], 79: [1, 31], 80: 30 }, { 66: [1, 70] }, { 21: [2, 39], 31: [2, 39], 52: [2, 39], 59: [2, 39], 62: [2, 39], 66: [2, 39], 69: [2, 39], 74: [2, 39], 75: [2, 39], 76: [2, 39], 77: [2, 39], 78: [2, 39], 79: [2, 39], 81: [1, 45] }, { 18: 65, 51: 71, 52: [2, 79], 57: 72, 58: 66, 59: [1, 40], 63: 73, 64: 67, 65: 68, 66: [1, 69], 72: 23, 73: 24, 74: [1, 25], 75: [1, 26], 76: [1, 27], 77: [1, 28], 78: [1, 29], 79: [1, 31], 80: 30 }, { 24: 74, 45: [1, 75] }, { 45: [2, 50] }, { 4: 76, 6: 3, 13: [2, 43], 14: [2, 43], 17: [2, 43], 27: [2, 43], 32: [2, 43], 37: [2, 43], 42: [2, 43], 45: [2, 43], 46: [2, 43], 49: [2, 43], 53: [2, 43] }, { 45: [2, 19] }, { 18: 77, 66: [1, 32], 72: 23, 73: 24, 74: [1, 25], 75: [1, 26], 76: [1, 27], 77: [1, 28], 78: [1, 29], 79: [1, 31], 80: 30 }, { 4: 78, 6: 3, 13: [2, 43], 14: [2, 43], 17: [2, 43], 27: [2, 43], 32: [2, 43], 45: [2, 43], 46: [2, 43], 49: [2, 43], 53: [2, 43] }, { 24: 79, 45: [1, 75] }, { 45: [2, 52] }, { 5: [2, 10], 13: [2, 10], 14: [2, 10], 17: [2, 10], 27: [2, 10], 32: [2, 10], 37: [2, 10], 42: [2, 10], 45: [2, 10], 46: [2, 10], 49: [2, 10], 53: [2, 10] }, { 18: 65, 31: [2, 83], 56: 80, 57: 81, 58: 66, 59: [1, 40], 63: 82, 64: 67, 65: 68, 66: [1, 69], 72: 23, 73: 24, 74: [1, 25], 75: [1, 26], 76: [1, 27], 77: [1, 28], 78: [1, 29], 79: [1, 31], 80: 30 }, { 59: [2, 85], 60: 83, 62: [2, 85], 66: [2, 85], 74: [2, 85], 75: [2, 85], 76: [2, 85], 77: [2, 85], 78: [2, 85], 79: [2, 85] }, { 18: 65, 29: 84, 31: [2, 55], 57: 85, 58: 66, 59: [1, 40], 63: 86, 64: 67, 65: 68, 66: [1, 69], 69: [2, 55], 72: 23, 73: 24, 74: [1, 25], 75: [1, 26], 76: [1, 27], 77: [1, 28], 78: [1, 29], 79: [1, 31], 80: 30 }, { 18: 65, 31: [2, 61], 34: 87, 57: 88, 58: 66, 59: [1, 40], 63: 89, 64: 67, 65: 68, 66: [1, 69], 69: [2, 61], 72: 23, 73: 24, 74: [1, 25], 75: [1, 26], 76: [1, 27], 77: [1, 28], 78: [1, 29], 79: [1, 31], 80: 30 }, { 18: 65, 20: 90, 21: [2, 47], 57: 91, 58: 66, 59: [1, 40], 63: 92, 64: 67, 65: 68, 66: [1, 69], 72: 23, 73: 24, 74: [1, 25], 75: [1, 26], 76: [1, 27], 77: [1, 28], 78: [1, 29], 79: [1, 31], 80: 30 }, { 31: [1, 93] }, { 31: [2, 74], 59: [2, 74], 66: [2, 74], 74: [2, 74], 75: [2, 74], 76: [2, 74], 77: [2, 74], 78: [2, 74], 79: [2, 74] }, { 31: [2, 76] }, { 21: [2, 24], 31: [2, 24], 52: [2, 24], 59: [2, 24], 62: [2, 24], 66: [2, 24], 69: [2, 24], 74: [2, 24], 75: [2, 24], 76: [2, 24], 77: [2, 24], 78: [2, 24], 79: [2, 24] }, { 21: [2, 25], 31: [2, 25], 52: [2, 25], 59: [2, 25], 62: [2, 25], 66: [2, 25], 69: [2, 25], 74: [2, 25], 75: [2, 25], 76: [2, 25], 77: [2, 25], 78: [2, 25], 79: [2, 25] }, { 21: [2, 27], 31: [2, 27], 52: [2, 27], 62: [2, 27], 65: 94, 66: [1, 95], 69: [2, 27] }, { 21: [2, 89], 31: [2, 89], 52: [2, 89], 62: [2, 89], 66: [2, 89], 69: [2, 89] }, { 21: [2, 42], 31: [2, 42], 52: [2, 42], 59: [2, 42], 62: [2, 42], 66: [2, 42], 67: [1, 96], 69: [2, 42], 74: [2, 42], 75: [2, 42], 76: [2, 42], 77: [2, 42], 78: [2, 42], 79: [2, 42], 81: [2, 42] }, { 21: [2, 41], 31: [2, 41], 52: [2, 41], 59: [2, 41], 62: [2, 41], 66: [2, 41], 69: [2, 41], 74: [2, 41], 75: [2, 41], 76: [2, 41], 77: [2, 41], 78: [2, 41], 79: [2, 41], 81: [2, 41] }, { 52: [1, 97] }, { 52: [2, 78], 59: [2, 78], 66: [2, 78], 74: [2, 78], 75: [2, 78], 76: [2, 78], 77: [2, 78], 78: [2, 78], 79: [2, 78] }, { 52: [2, 80] }, { 5: [2, 12], 13: [2, 12], 14: [2, 12], 17: [2, 12], 27: [2, 12], 32: [2, 12], 37: [2, 12], 42: [2, 12], 45: [2, 12], 46: [2, 12], 49: [2, 12], 53: [2, 12] }, { 18: 98, 66: [1, 32], 72: 23, 73: 24, 74: [1, 25], 75: [1, 26], 76: [1, 27], 77: [1, 28], 78: [1, 29], 79: [1, 31], 80: 30 }, { 36: 50, 37: [1, 52], 41: 51, 42: [1, 53], 43: 100, 44: 99, 45: [2, 71] }, { 31: [2, 65], 38: 101, 59: [2, 65], 66: [2, 65], 69: [2, 65], 74: [2, 65], 75: [2, 65], 76: [2, 65], 77: [2, 65], 78: [2, 65], 79: [2, 65] }, { 45: [2, 17] }, { 5: [2, 13], 13: [2, 13], 14: [2, 13], 17: [2, 13], 27: [2, 13], 32: [2, 13], 37: [2, 13], 42: [2, 13], 45: [2, 13], 46: [2, 13], 49: [2, 13], 53: [2, 13] }, { 31: [1, 102] }, { 31: [2, 82], 59: [2, 82], 66: [2, 82], 74: [2, 82], 75: [2, 82], 76: [2, 82], 77: [2, 82], 78: [2, 82], 79: [2, 82] }, { 31: [2, 84] }, { 18: 65, 57: 104, 58: 66, 59: [1, 40], 61: 103, 62: [2, 87], 63: 105, 64: 67, 65: 68, 66: [1, 69], 72: 23, 73: 24, 74: [1, 25], 75: [1, 26], 76: [1, 27], 77: [1, 28], 78: [1, 29], 79: [1, 31], 80: 30 }, { 30: 106, 31: [2, 57], 68: 107, 69: [1, 108] }, { 31: [2, 54], 59: [2, 54], 66: [2, 54], 69: [2, 54], 74: [2, 54], 75: [2, 54], 76: [2, 54], 77: [2, 54], 78: [2, 54], 79: [2, 54] }, { 31: [2, 56], 69: [2, 56] }, { 31: [2, 63], 35: 109, 68: 110, 69: [1, 108] }, { 31: [2, 60], 59: [2, 60], 66: [2, 60], 69: [2, 60], 74: [2, 60], 75: [2, 60], 76: [2, 60], 77: [2, 60], 78: [2, 60], 79: [2, 60] }, { 31: [2, 62], 69: [2, 62] }, { 21: [1, 111] }, { 21: [2, 46], 59: [2, 46], 66: [2, 46], 74: [2, 46], 75: [2, 46], 76: [2, 46], 77: [2, 46], 78: [2, 46], 79: [2, 46] }, { 21: [2, 48] }, { 5: [2, 21], 13: [2, 21], 14: [2, 21], 17: [2, 21], 27: [2, 21], 32: [2, 21], 37: [2, 21], 42: [2, 21], 45: [2, 21], 46: [2, 21], 49: [2, 21], 53: [2, 21] }, { 21: [2, 90], 31: [2, 90], 52: [2, 90], 62: [2, 90], 66: [2, 90], 69: [2, 90] }, { 67: [1, 96] }, { 18: 65, 57: 112, 58: 66, 59: [1, 40], 66: [1, 32], 72: 23, 73: 24, 74: [1, 25], 75: [1, 26], 76: [1, 27], 77: [1, 28], 78: [1, 29], 79: [1, 31], 80: 30 }, { 5: [2, 22], 13: [2, 22], 14: [2, 22], 17: [2, 22], 27: [2, 22], 32: [2, 22], 37: [2, 22], 42: [2, 22], 45: [2, 22], 46: [2, 22], 49: [2, 22], 53: [2, 22] }, { 31: [1, 113] }, { 45: [2, 18] }, { 45: [2, 72] }, { 18: 65, 31: [2, 67], 39: 114, 57: 115, 58: 66, 59: [1, 40], 63: 116, 64: 67, 65: 68, 66: [1, 69], 69: [2, 67], 72: 23, 73: 24, 74: [1, 25], 75: [1, 26], 76: [1, 27], 77: [1, 28], 78: [1, 29], 79: [1, 31], 80: 30 }, { 5: [2, 23], 13: [2, 23], 14: [2, 23], 17: [2, 23], 27: [2, 23], 32: [2, 23], 37: [2, 23], 42: [2, 23], 45: [2, 23], 46: [2, 23], 49: [2, 23], 53: [2, 23] }, { 62: [1, 117] }, { 59: [2, 86], 62: [2, 86], 66: [2, 86], 74: [2, 86], 75: [2, 86], 76: [2, 86], 77: [2, 86], 78: [2, 86], 79: [2, 86] }, { 62: [2, 88] }, { 31: [1, 118] }, { 31: [2, 58] }, { 66: [1, 120], 70: 119 }, { 31: [1, 121] }, { 31: [2, 64] }, { 14: [2, 11] }, { 21: [2, 28], 31: [2, 28], 52: [2, 28], 62: [2, 28], 66: [2, 28], 69: [2, 28] }, { 5: [2, 20], 13: [2, 20], 14: [2, 20], 17: [2, 20], 27: [2, 20], 32: [2, 20], 37: [2, 20], 42: [2, 20], 45: [2, 20], 46: [2, 20], 49: [2, 20], 53: [2, 20] }, { 31: [2, 69], 40: 122, 68: 123, 69: [1, 108] }, { 31: [2, 66], 59: [2, 66], 66: [2, 66], 69: [2, 66], 74: [2, 66], 75: [2, 66], 76: [2, 66], 77: [2, 66], 78: [2, 66], 79: [2, 66] }, { 31: [2, 68], 69: [2, 68] }, { 21: [2, 26], 31: [2, 26], 52: [2, 26], 59: [2, 26], 62: [2, 26], 66: [2, 26], 69: [2, 26], 74: [2, 26], 75: [2, 26], 76: [2, 26], 77: [2, 26], 78: [2, 26], 79: [2, 26] }, { 13: [2, 14], 14: [2, 14], 17: [2, 14], 27: [2, 14], 32: [2, 14], 37: [2, 14], 42: [2, 14], 45: [2, 14], 46: [2, 14], 49: [2, 14], 53: [2, 14] }, { 66: [1, 125], 71: [1, 124] }, { 66: [2, 91], 71: [2, 91] }, { 13: [2, 15], 14: [2, 15], 17: [2, 15], 27: [2, 15], 32: [2, 15], 42: [2, 15], 45: [2, 15], 46: [2, 15], 49: [2, 15], 53: [2, 15] }, { 31: [1, 126] }, { 31: [2, 70] }, { 31: [2, 29] }, { 66: [2, 92], 71: [2, 92] }, { 13: [2, 16], 14: [2, 16], 17: [2, 16], 27: [2, 16], 32: [2, 16], 37: [2, 16], 42: [2, 16], 45: [2, 16], 46: [2, 16], 49: [2, 16], 53: [2, 16] }],
      defaultActions: { 4: [2, 1], 49: [2, 50], 51: [2, 19], 55: [2, 52], 64: [2, 76], 73: [2, 80], 78: [2, 17], 82: [2, 84], 92: [2, 48], 99: [2, 18], 100: [2, 72], 105: [2, 88], 107: [2, 58], 110: [2, 64], 111: [2, 11], 123: [2, 70], 124: [2, 29] },
      parseError: function parseError(str, hash) {
        throw new Error(str);
      },
      parse: function parse(input) {
        var self = this,
            stack = [0],
            vstack = [null],
            lstack = [],
            table = this.table,
            yytext = "",
            yylineno = 0,
            yyleng = 0,
            recovering = 0,
            TERROR = 2,
            EOF = 1;
        this.lexer.setInput(input);
        this.lexer.yy = this.yy;
        this.yy.lexer = this.lexer;
        this.yy.parser = this;
        if (typeof this.lexer.yylloc == "undefined") this.lexer.yylloc = {};
        var yyloc = this.lexer.yylloc;
        lstack.push(yyloc);
        var ranges = this.lexer.options && this.lexer.options.ranges;
        if (typeof this.yy.parseError === "function") this.parseError = this.yy.parseError;
        function popStack(n) {
          stack.length = stack.length - 2 * n;
          vstack.length = vstack.length - n;
          lstack.length = lstack.length - n;
        }
        function lex() {
          var token;
          token = self.lexer.lex() || 1;
          if (typeof token !== "number") {
            token = self.symbols_[token] || token;
          }
          return token;
        }
        var symbol,
            preErrorSymbol,
            state,
            action,
            a,
            r,
            yyval = {},
            p,
            len,
            newState,
            expected;
        while (true) {
          state = stack[stack.length - 1];
          if (this.defaultActions[state]) {
            action = this.defaultActions[state];
          } else {
            if (symbol === null || typeof symbol == "undefined") {
              symbol = lex();
            }
            action = table[state] && table[state][symbol];
          }
          if (typeof action === "undefined" || !action.length || !action[0]) {
            var errStr = "";
            if (!recovering) {
              expected = [];
              for (p in table[state]) if (this.terminals_[p] && p > 2) {
                expected.push("'" + this.terminals_[p] + "'");
              }
              if (this.lexer.showPosition) {
                errStr = "Parse error on line " + (yylineno + 1) + ":\n" + this.lexer.showPosition() + "\nExpecting " + expected.join(", ") + ", got '" + (this.terminals_[symbol] || symbol) + "'";
              } else {
                errStr = "Parse error on line " + (yylineno + 1) + ": Unexpected " + (symbol == 1 ? "end of input" : "'" + (this.terminals_[symbol] || symbol) + "'");
              }
              this.parseError(errStr, { text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected });
            }
          }
          if (action[0] instanceof Array && action.length > 1) {
            throw new Error("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
          }
          switch (action[0]) {
            case 1:
              stack.push(symbol);
              vstack.push(this.lexer.yytext);
              lstack.push(this.lexer.yylloc);
              stack.push(action[1]);
              symbol = null;
              if (!preErrorSymbol) {
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                if (recovering > 0) recovering--;
              } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
              }
              break;
            case 2:
              len = this.productions_[action[1]][1];
              yyval.$ = vstack[vstack.length - len];
              yyval._$ = { first_line: lstack[lstack.length - (len || 1)].first_line, last_line: lstack[lstack.length - 1].last_line, first_column: lstack[lstack.length - (len || 1)].first_column, last_column: lstack[lstack.length - 1].last_column };
              if (ranges) {
                yyval._$.range = [lstack[lstack.length - (len || 1)].range[0], lstack[lstack.length - 1].range[1]];
              }
              r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);
              if (typeof r !== "undefined") {
                return r;
              }
              if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
              }
              stack.push(this.productions_[action[1]][0]);
              vstack.push(yyval.$);
              lstack.push(yyval._$);
              newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
              stack.push(newState);
              break;
            case 3:
              return true;
          }
        }
        return true;
      }
    };
    /* Jison generated lexer */
    var lexer = (function () {
      var lexer = { EOF: 1,
        parseError: function parseError(str, hash) {
          if (this.yy.parser) {
            this.yy.parser.parseError(str, hash);
          } else {
            throw new Error(str);
          }
        },
        setInput: function (input) {
          this._input = input;
          this._more = this._less = this.done = false;
          this.yylineno = this.yyleng = 0;
          this.yytext = this.matched = this.match = '';
          this.conditionStack = ['INITIAL'];
          this.yylloc = { first_line: 1, first_column: 0, last_line: 1, last_column: 0 };
          if (this.options.ranges) this.yylloc.range = [0, 0];
          this.offset = 0;
          return this;
        },
        input: function () {
          var ch = this._input[0];
          this.yytext += ch;
          this.yyleng++;
          this.offset++;
          this.match += ch;
          this.matched += ch;
          var lines = ch.match(/(?:\r\n?|\n).*/g);
          if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
          } else {
            this.yylloc.last_column++;
          }
          if (this.options.ranges) this.yylloc.range[1]++;

          this._input = this._input.slice(1);
          return ch;
        },
        unput: function (ch) {
          var len = ch.length;
          var lines = ch.split(/(?:\r\n?|\n)/g);

          this._input = ch + this._input;
          this.yytext = this.yytext.substr(0, this.yytext.length - len - 1);
          //this.yyleng -= len;
          this.offset -= len;
          var oldLines = this.match.split(/(?:\r\n?|\n)/g);
          this.match = this.match.substr(0, this.match.length - 1);
          this.matched = this.matched.substr(0, this.matched.length - 1);

          if (lines.length - 1) this.yylineno -= lines.length - 1;
          var r = this.yylloc.range;

          this.yylloc = { first_line: this.yylloc.first_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.first_column,
            last_column: lines ? (lines.length === oldLines.length ? this.yylloc.first_column : 0) + oldLines[oldLines.length - lines.length].length - lines[0].length : this.yylloc.first_column - len
          };

          if (this.options.ranges) {
            this.yylloc.range = [r[0], r[0] + this.yyleng - len];
          }
          return this;
        },
        more: function () {
          this._more = true;
          return this;
        },
        less: function (n) {
          this.unput(this.match.slice(n));
        },
        pastInput: function () {
          var past = this.matched.substr(0, this.matched.length - this.match.length);
          return (past.length > 20 ? '...' : '') + past.substr(-20).replace(/\n/g, "");
        },
        upcomingInput: function () {
          var next = this.match;
          if (next.length < 20) {
            next += this._input.substr(0, 20 - next.length);
          }
          return (next.substr(0, 20) + (next.length > 20 ? '...' : '')).replace(/\n/g, "");
        },
        showPosition: function () {
          var pre = this.pastInput();
          var c = new Array(pre.length + 1).join("-");
          return pre + this.upcomingInput() + "\n" + c + "^";
        },
        next: function () {
          if (this.done) {
            return this.EOF;
          }
          if (!this._input) this.done = true;

          var token, match, tempMatch, index, col, lines;
          if (!this._more) {
            this.yytext = '';
            this.match = '';
          }
          var rules = this._currentRules();
          for (var i = 0; i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
              match = tempMatch;
              index = i;
              if (!this.options.flex) break;
            }
          }
          if (match) {
            lines = match[0].match(/(?:\r\n?|\n).*/g);
            if (lines) this.yylineno += lines.length;
            this.yylloc = { first_line: this.yylloc.last_line,
              last_line: this.yylineno + 1,
              first_column: this.yylloc.last_column,
              last_column: lines ? lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length : this.yylloc.last_column + match[0].length };
            this.yytext += match[0];
            this.match += match[0];
            this.matches = match;
            this.yyleng = this.yytext.length;
            if (this.options.ranges) {
              this.yylloc.range = [this.offset, this.offset += this.yyleng];
            }
            this._more = false;
            this._input = this._input.slice(match[0].length);
            this.matched += match[0];
            token = this.performAction.call(this, this.yy, this, rules[index], this.conditionStack[this.conditionStack.length - 1]);
            if (this.done && this._input) this.done = false;
            if (token) return token;else return;
          }
          if (this._input === "") {
            return this.EOF;
          } else {
            return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), { text: "", token: null, line: this.yylineno });
          }
        },
        lex: function lex() {
          var r = this.next();
          if (typeof r !== 'undefined') {
            return r;
          } else {
            return this.lex();
          }
        },
        begin: function begin(condition) {
          this.conditionStack.push(condition);
        },
        popState: function popState() {
          return this.conditionStack.pop();
        },
        _currentRules: function _currentRules() {
          return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        },
        topState: function () {
          return this.conditionStack[this.conditionStack.length - 2];
        },
        pushState: function begin(condition) {
          this.begin(condition);
        } };
      lexer.options = {};
      lexer.performAction = function anonymous(yy, yy_, $avoiding_name_collisions, YY_START) {

        function strip(start, end) {
          return yy_.yytext = yy_.yytext.substr(start, yy_.yyleng - end);
        }

        var YYSTATE = YY_START;
        switch ($avoiding_name_collisions) {
          case 0:
            if (yy_.yytext.slice(-2) === "\\\\") {
              strip(0, 1);
              this.begin("mu");
            } else if (yy_.yytext.slice(-1) === "\\") {
              strip(0, 1);
              this.begin("emu");
            } else {
              this.begin("mu");
            }
            if (yy_.yytext) return 14;

            break;
          case 1:
            return 14;
            break;
          case 2:
            this.popState();
            return 14;

            break;
          case 3:
            yy_.yytext = yy_.yytext.substr(5, yy_.yyleng - 9);
            this.popState();
            return 16;

            break;
          case 4:
            return 14;
            break;
          case 5:
            this.popState();
            return 13;

            break;
          case 6:
            return 59;
            break;
          case 7:
            return 62;
            break;
          case 8:
            return 17;
            break;
          case 9:
            this.popState();
            this.begin('raw');
            return 21;

            break;
          case 10:
            return 53;
            break;
          case 11:
            return 27;
            break;
          case 12:
            return 45;
            break;
          case 13:
            this.popState();return 42;
            break;
          case 14:
            this.popState();return 42;
            break;
          case 15:
            return 32;
            break;
          case 16:
            return 37;
            break;
          case 17:
            return 49;
            break;
          case 18:
            return 46;
            break;
          case 19:
            this.unput(yy_.yytext);
            this.popState();
            this.begin('com');

            break;
          case 20:
            this.popState();
            return 13;

            break;
          case 21:
            return 46;
            break;
          case 22:
            return 67;
            break;
          case 23:
            return 66;
            break;
          case 24:
            return 66;
            break;
          case 25:
            return 81;
            break;
          case 26:
            // ignore whitespace
            break;
          case 27:
            this.popState();return 52;
            break;
          case 28:
            this.popState();return 31;
            break;
          case 29:
            yy_.yytext = strip(1, 2).replace(/\\"/g, '"');return 74;
            break;
          case 30:
            yy_.yytext = strip(1, 2).replace(/\\'/g, "'");return 74;
            break;
          case 31:
            return 79;
            break;
          case 32:
            return 76;
            break;
          case 33:
            return 76;
            break;
          case 34:
            return 77;
            break;
          case 35:
            return 78;
            break;
          case 36:
            return 75;
            break;
          case 37:
            return 69;
            break;
          case 38:
            return 71;
            break;
          case 39:
            return 66;
            break;
          case 40:
            return 66;
            break;
          case 41:
            return 'INVALID';
            break;
          case 42:
            return 5;
            break;
        }
      };
      lexer.rules = [/^(?:[^\x00]*?(?=(\{\{)))/, /^(?:[^\x00]+)/, /^(?:[^\x00]{2,}?(?=(\{\{|\\\{\{|\\\\\{\{|$)))/, /^(?:\{\{\{\{\/[^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=[=}\s\/.])\}\}\}\})/, /^(?:[^\x00]*?(?=(\{\{\{\{\/)))/, /^(?:[\s\S]*?--(~)?\}\})/, /^(?:\()/, /^(?:\))/, /^(?:\{\{\{\{)/, /^(?:\}\}\}\})/, /^(?:\{\{(~)?>)/, /^(?:\{\{(~)?#)/, /^(?:\{\{(~)?\/)/, /^(?:\{\{(~)?\^\s*(~)?\}\})/, /^(?:\{\{(~)?\s*else\s*(~)?\}\})/, /^(?:\{\{(~)?\^)/, /^(?:\{\{(~)?\s*else\b)/, /^(?:\{\{(~)?\{)/, /^(?:\{\{(~)?&)/, /^(?:\{\{(~)?!--)/, /^(?:\{\{(~)?![\s\S]*?\}\})/, /^(?:\{\{(~)?)/, /^(?:=)/, /^(?:\.\.)/, /^(?:\.(?=([=~}\s\/.)|])))/, /^(?:[\/.])/, /^(?:\s+)/, /^(?:\}(~)?\}\})/, /^(?:(~)?\}\})/, /^(?:"(\\["]|[^"])*")/, /^(?:'(\\[']|[^'])*')/, /^(?:@)/, /^(?:true(?=([~}\s)])))/, /^(?:false(?=([~}\s)])))/, /^(?:undefined(?=([~}\s)])))/, /^(?:null(?=([~}\s)])))/, /^(?:-?[0-9]+(?:\.[0-9]+)?(?=([~}\s)])))/, /^(?:as\s+\|)/, /^(?:\|)/, /^(?:([^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=([=~}\s\/.)|]))))/, /^(?:\[[^\]]*\])/, /^(?:.)/, /^(?:$)/];
      lexer.conditions = { "mu": { "rules": [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42], "inclusive": false }, "emu": { "rules": [2], "inclusive": false }, "com": { "rules": [5], "inclusive": false }, "raw": { "rules": [3, 4], "inclusive": false }, "INITIAL": { "rules": [0, 1, 42], "inclusive": true } };
      return lexer;
    })();
    parser.lexer = lexer;
    function Parser() {
      this.yy = {};
    }Parser.prototype = parser;parser.Parser = Parser;
    return new Parser();
  })();

  var AST = {
    Program: function (statements, blockParams, strip, locInfo) {
      this.loc = locInfo;
      this.type = 'Program';
      this.body = statements;

      this.blockParams = blockParams;
      this.strip = strip;
    },

    MustacheStatement: function (path, params, hash, escaped, strip, locInfo) {
      this.loc = locInfo;
      this.type = 'MustacheStatement';

      this.path = path;
      this.params = params || [];
      this.hash = hash;
      this.escaped = escaped;

      this.strip = strip;
    },

    BlockStatement: function (path, params, hash, program, inverse, openStrip, inverseStrip, closeStrip, locInfo) {
      this.loc = locInfo;
      this.type = 'BlockStatement';

      this.path = path;
      this.params = params || [];
      this.hash = hash;
      this.program = program;
      this.inverse = inverse;

      this.openStrip = openStrip;
      this.inverseStrip = inverseStrip;
      this.closeStrip = closeStrip;
    },

    PartialStatement: function (name, params, hash, strip, locInfo) {
      this.loc = locInfo;
      this.type = 'PartialStatement';

      this.name = name;
      this.params = params || [];
      this.hash = hash;

      this.indent = '';
      this.strip = strip;
    },

    ContentStatement: function (string, locInfo) {
      this.loc = locInfo;
      this.type = 'ContentStatement';
      this.original = this.value = string;
    },

    CommentStatement: function (comment, strip, locInfo) {
      this.loc = locInfo;
      this.type = 'CommentStatement';
      this.value = comment;

      this.strip = strip;
    },

    SubExpression: function (path, params, hash, locInfo) {
      this.loc = locInfo;

      this.type = 'SubExpression';
      this.path = path;
      this.params = params || [];
      this.hash = hash;
    },

    PathExpression: function (data, depth, parts, original, locInfo) {
      this.loc = locInfo;
      this.type = 'PathExpression';

      this.data = data;
      this.original = original;
      this.parts = parts;
      this.depth = depth;
    },

    StringLiteral: function (string, locInfo) {
      this.loc = locInfo;
      this.type = 'StringLiteral';
      this.original = this.value = string;
    },

    NumberLiteral: function (number, locInfo) {
      this.loc = locInfo;
      this.type = 'NumberLiteral';
      this.original = this.value = Number(number);
    },

    BooleanLiteral: function (bool, locInfo) {
      this.loc = locInfo;
      this.type = 'BooleanLiteral';
      this.original = this.value = bool === 'true';
    },

    UndefinedLiteral: function (locInfo) {
      this.loc = locInfo;
      this.type = 'UndefinedLiteral';
      this.original = this.value = undefined;
    },

    NullLiteral: function (locInfo) {
      this.loc = locInfo;
      this.type = 'NullLiteral';
      this.original = this.value = null;
    },

    Hash: function (pairs, locInfo) {
      this.loc = locInfo;
      this.type = 'Hash';
      this.pairs = pairs;
    },
    HashPair: function (key, value, locInfo) {
      this.loc = locInfo;
      this.type = 'HashPair';
      this.key = key;
      this.value = value;
    },

    // Public API used to evaluate derived attributes regarding AST nodes
    helpers: {
      // a mustache is definitely a helper if:
      // * it is an eligible helper, and
      // * it has at least one parameter or hash segment
      helperExpression: function (node) {
        return !!(node.type === 'SubExpression' || node.params.length || node.hash);
      },

      scopedId: function (path) {
        return (/^\.|this\b/.test(path.original)
        );
      },

      // an ID is simple if it only has one part, and that part is not
      // `..` or `this`.
      simpleId: function (path) {
        return path.parts.length === 1 && !AST.helpers.scopedId(path) && !path.depth;
      }
    }
  };

  var errorProps = ['description', 'fileName', 'lineNumber', 'message', 'name', 'number', 'stack'];

  function Exception(message, node) {
    var loc = node && node.loc,
        line = undefined,
        column = undefined;
    if (loc) {
      line = loc.start.line;
      column = loc.start.column;

      message += ' - ' + line + ':' + column;
    }

    var tmp = Error.prototype.constructor.call(this, message);

    // Unfortunately errors are not enumerable in Chrome (at least), so `for prop in tmp` doesn't work.
    for (var idx = 0; idx < errorProps.length; idx++) {
      this[errorProps[idx]] = tmp[errorProps[idx]];
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, Exception);
    }

    if (loc) {
      this.lineNumber = line;
      this.column = column;
    }
  }

  Exception.prototype = new Error();

  function Visitor() {
    this.parents = [];
  }

  Visitor.prototype = {
    constructor: Visitor,
    mutating: false,

    // Visits a given value. If mutating, will replace the value if necessary.
    acceptKey: function (node, name) {
      var value = this.accept(node[name]);
      if (this.mutating) {
        // Hacky sanity check:
        if (value && (!value.type || !AST[value.type])) {
          throw new Exception('Unexpected node type "' + value.type + '" found when accepting ' + name + ' on ' + node.type);
        }
        node[name] = value;
      }
    },

    // Performs an accept operation with added sanity check to ensure
    // required keys are not removed.
    acceptRequired: function (node, name) {
      this.acceptKey(node, name);

      if (!node[name]) {
        throw new Exception(node.type + ' requires ' + name);
      }
    },

    // Traverses a given array. If mutating, empty respnses will be removed
    // for child elements.
    acceptArray: function (array) {
      for (var i = 0, l = array.length; i < l; i++) {
        this.acceptKey(array, i);

        if (!array[i]) {
          array.splice(i, 1);
          i--;
          l--;
        }
      }
    },

    accept: function (object) {
      if (!object) {
        return;
      }

      if (this.current) {
        this.parents.unshift(this.current);
      }
      this.current = object;

      var ret = this[object.type](object);

      this.current = this.parents.shift();

      if (!this.mutating || ret) {
        return ret;
      } else if (ret !== false) {
        return object;
      }
    },

    Program: function (program) {
      this.acceptArray(program.body);
    },

    MustacheStatement: function (mustache) {
      this.acceptRequired(mustache, 'path');
      this.acceptArray(mustache.params);
      this.acceptKey(mustache, 'hash');
    },

    BlockStatement: function (block) {
      this.acceptRequired(block, 'path');
      this.acceptArray(block.params);
      this.acceptKey(block, 'hash');

      this.acceptKey(block, 'program');
      this.acceptKey(block, 'inverse');
    },

    PartialStatement: function (partial) {
      this.acceptRequired(partial, 'name');
      this.acceptArray(partial.params);
      this.acceptKey(partial, 'hash');
    },

    ContentStatement: function () /* content */{},
    CommentStatement: function () /* comment */{},

    SubExpression: function (sexpr) {
      this.acceptRequired(sexpr, 'path');
      this.acceptArray(sexpr.params);
      this.acceptKey(sexpr, 'hash');
    },

    PathExpression: function () /* path */{},

    StringLiteral: function () /* string */{},
    NumberLiteral: function () /* number */{},
    BooleanLiteral: function () /* bool */{},
    UndefinedLiteral: function () /* literal */{},
    NullLiteral: function () /* literal */{},

    Hash: function (hash) {
      this.acceptArray(hash.pairs);
    },
    HashPair: function (pair) {
      this.acceptRequired(pair, 'value');
    }
  };

  function WhitespaceControl() {}
  WhitespaceControl.prototype = new Visitor();

  WhitespaceControl.prototype.Program = function (program) {
    var isRoot = !this.isRootSeen;
    this.isRootSeen = true;

    var body = program.body;
    for (var i = 0, l = body.length; i < l; i++) {
      var current = body[i],
          strip = this.accept(current);

      if (!strip) {
        continue;
      }

      var _isPrevWhitespace = isPrevWhitespace(body, i, isRoot),
          _isNextWhitespace = isNextWhitespace(body, i, isRoot),
          openStandalone = strip.openStandalone && _isPrevWhitespace,
          closeStandalone = strip.closeStandalone && _isNextWhitespace,
          inlineStandalone = strip.inlineStandalone && _isPrevWhitespace && _isNextWhitespace;

      if (strip.close) {
        omitRight(body, i, true);
      }
      if (strip.open) {
        omitLeft(body, i, true);
      }

      if (inlineStandalone) {
        omitRight(body, i);

        if (omitLeft(body, i)) {
          // If we are on a standalone node, save the indent info for partials
          if (current.type === 'PartialStatement') {
            // Pull out the whitespace from the final line
            current.indent = /([ \t]+$)/.exec(body[i - 1].original)[1];
          }
        }
      }
      if (openStandalone) {
        omitRight((current.program || current.inverse).body);

        // Strip out the previous content node if it's whitespace only
        omitLeft(body, i);
      }
      if (closeStandalone) {
        // Always strip the next node
        omitRight(body, i);

        omitLeft((current.inverse || current.program).body);
      }
    }

    return program;
  };
  WhitespaceControl.prototype.BlockStatement = function (block) {
    this.accept(block.program);
    this.accept(block.inverse);

    // Find the inverse program that is involed with whitespace stripping.
    var program = block.program || block.inverse,
        inverse = block.program && block.inverse,
        firstInverse = inverse,
        lastInverse = inverse;

    if (inverse && inverse.chained) {
      firstInverse = inverse.body[0].program;

      // Walk the inverse chain to find the last inverse that is actually in the chain.
      while (lastInverse.chained) {
        lastInverse = lastInverse.body[lastInverse.body.length - 1].program;
      }
    }

    var strip = {
      open: block.openStrip.open,
      close: block.closeStrip.close,

      // Determine the standalone candiacy. Basically flag our content as being possibly standalone
      // so our parent can determine if we actually are standalone
      openStandalone: isNextWhitespace(program.body),
      closeStandalone: isPrevWhitespace((firstInverse || program).body)
    };

    if (block.openStrip.close) {
      omitRight(program.body, null, true);
    }

    if (inverse) {
      var inverseStrip = block.inverseStrip;

      if (inverseStrip.open) {
        omitLeft(program.body, null, true);
      }

      if (inverseStrip.close) {
        omitRight(firstInverse.body, null, true);
      }
      if (block.closeStrip.open) {
        omitLeft(lastInverse.body, null, true);
      }

      // Find standalone else statments
      if (isPrevWhitespace(program.body) && isNextWhitespace(firstInverse.body)) {
        omitLeft(program.body);
        omitRight(firstInverse.body);
      }
    } else if (block.closeStrip.open) {
      omitLeft(program.body, null, true);
    }

    return strip;
  };

  WhitespaceControl.prototype.MustacheStatement = function (mustache) {
    return mustache.strip;
  };

  WhitespaceControl.prototype.PartialStatement = WhitespaceControl.prototype.CommentStatement = function (node) {
    /* istanbul ignore next */
    var strip = node.strip || {};
    return {
      inlineStandalone: true,
      open: strip.open,
      close: strip.close
    };
  };

  function isPrevWhitespace(body, i, isRoot) {
    if (i === undefined) {
      i = body.length;
    }

    // Nodes that end with newlines are considered whitespace (but are special
    // cased for strip operations)
    var prev = body[i - 1],
        sibling = body[i - 2];
    if (!prev) {
      return isRoot;
    }

    if (prev.type === 'ContentStatement') {
      return (sibling || !isRoot ? /\r?\n\s*?$/ : /(^|\r?\n)\s*?$/).test(prev.original);
    }
  }
  function isNextWhitespace(body, i, isRoot) {
    if (i === undefined) {
      i = -1;
    }

    var next = body[i + 1],
        sibling = body[i + 2];
    if (!next) {
      return isRoot;
    }

    if (next.type === 'ContentStatement') {
      return (sibling || !isRoot ? /^\s*?\r?\n/ : /^\s*?(\r?\n|$)/).test(next.original);
    }
  }

  // Marks the node to the right of the position as omitted.
  // I.e. {{foo}}' ' will mark the ' ' node as omitted.
  //
  // If i is undefined, then the first child will be marked as such.
  //
  // If mulitple is truthy then all whitespace will be stripped out until non-whitespace
  // content is met.
  function omitRight(body, i, multiple) {
    var current = body[i == null ? 0 : i + 1];
    if (!current || current.type !== 'ContentStatement' || !multiple && current.rightStripped) {
      return;
    }

    var original = current.value;
    current.value = current.value.replace(multiple ? /^\s+/ : /^[ \t]*\r?\n?/, '');
    current.rightStripped = current.value !== original;
  }

  // Marks the node to the left of the position as omitted.
  // I.e. ' '{{foo}} will mark the ' ' node as omitted.
  //
  // If i is undefined then the last child will be marked as such.
  //
  // If mulitple is truthy then all whitespace will be stripped out until non-whitespace
  // content is met.
  function omitLeft(body, i, multiple) {
    var current = body[i == null ? body.length - 1 : i - 1];
    if (!current || current.type !== 'ContentStatement' || !multiple && current.leftStripped) {
      return;
    }

    // We omit the last node if it's whitespace only and not preceeded by a non-content node.
    var original = current.value;
    current.value = current.value.replace(multiple ? /\s+$/ : /[ \t]+$/, '');
    current.leftStripped = current.value !== original;
    return current.leftStripped;
  }

  function SourceLocation(source, locInfo) {
    this.source = source;
    this.start = {
      line: locInfo.first_line,
      column: locInfo.first_column
    };
    this.end = {
      line: locInfo.last_line,
      column: locInfo.last_column
    };
  }

  function id(token) {
    if (/^\[.*\]$/.test(token)) {
      return token.substr(1, token.length - 2);
    } else {
      return token;
    }
  }

  function stripFlags(open, close) {
    return {
      open: open.charAt(2) === '~',
      close: close.charAt(close.length - 3) === '~'
    };
  }

  function stripComment(comment) {
    return comment.replace(/^\{\{~?\!-?-?/, '').replace(/-?-?~?\}\}$/, '');
  }

  function preparePath(data, parts, locInfo) {
    locInfo = this.locInfo(locInfo);

    var original = data ? '@' : '',
        dig = [],
        depth = 0,
        depthString = '';

    for (var i = 0, l = parts.length; i < l; i++) {
      var part = parts[i].part,

      // If we have [] syntax then we do not treat path references as operators,
      // i.e. foo.[this] resolves to approximately context.foo['this']
      isLiteral = parts[i].original !== part;
      original += (parts[i].separator || '') + part;

      if (!isLiteral && (part === '..' || part === '.' || part === 'this')) {
        if (dig.length > 0) {
          throw new Exception('Invalid path: ' + original, { loc: locInfo });
        } else if (part === '..') {
          depth++;
          depthString += '../';
        }
      } else {
        dig.push(part);
      }
    }

    return new this.PathExpression(data, depth, dig, original, locInfo);
  }

  function prepareMustache(path, params, hash, open, strip, locInfo) {
    // Must use charAt to support IE pre-10
    var escapeFlag = open.charAt(3) || open.charAt(2),
        escaped = escapeFlag !== '{' && escapeFlag !== '&';

    return new this.MustacheStatement(path, params, hash, escaped, strip, this.locInfo(locInfo));
  }

  function prepareRawBlock(openRawBlock, content, close, locInfo) {
    if (openRawBlock.path.original !== close) {
      var errorNode = { loc: openRawBlock.path.loc };

      throw new Exception(openRawBlock.path.original + " doesn't match " + close, errorNode);
    }

    locInfo = this.locInfo(locInfo);
    var program = new this.Program([content], null, {}, locInfo);

    return new this.BlockStatement(openRawBlock.path, openRawBlock.params, openRawBlock.hash, program, undefined, {}, {}, {}, locInfo);
  }

  function prepareBlock(openBlock, program, inverseAndProgram, close, inverted, locInfo) {
    // When we are chaining inverse calls, we will not have a close path
    if (close && close.path && openBlock.path.original !== close.path.original) {
      var errorNode = { loc: openBlock.path.loc };

      throw new Exception(openBlock.path.original + ' doesn\'t match ' + close.path.original, errorNode);
    }

    program.blockParams = openBlock.blockParams;

    var inverse = undefined,
        inverseStrip = undefined;

    if (inverseAndProgram) {
      if (inverseAndProgram.chain) {
        inverseAndProgram.program.body[0].closeStrip = close.strip;
      }

      inverseStrip = inverseAndProgram.strip;
      inverse = inverseAndProgram.program;
    }

    if (inverted) {
      inverted = inverse;
      inverse = program;
      program = inverted;
    }

    return new this.BlockStatement(openBlock.path, openBlock.params, openBlock.hash, program, inverse, openBlock.strip, inverseStrip, close && close.strip, this.locInfo(locInfo));
  }

  var Helpers = Object.freeze({
    SourceLocation: SourceLocation,
    id: id,
    stripFlags: stripFlags,
    stripComment: stripComment,
    preparePath: preparePath,
    prepareMustache: prepareMustache,
    prepareRawBlock: prepareRawBlock,
    prepareBlock: prepareBlock
  });

  function extend(obj /* , ...source */) {
    for (var i = 1; i < arguments.length; i++) {
      for (var key in arguments[i]) {
        if (Object.prototype.hasOwnProperty.call(arguments[i], key)) {
          obj[key] = arguments[i][key];
        }
      }
    }

    return obj;
  }

  var yy = {};
  extend(yy, Helpers, AST);

  function parse(input, options) {
    // Just return if an already-compiled AST was passed in.
    if (input.type === 'Program') {
      return input;
    }

    handlebars.yy = yy;

    // Altering the shared object here, but this is ok as parser is a sync operation
    yy.locInfo = function (locInfo) {
      return new yy.SourceLocation(options && options.srcName, locInfo);
    };

    var strip = new WhitespaceControl();
    return strip.accept(handlebars.parse(input));
  }

  exports.parser = handlebars;
  exports.parse = parse;
});
enifed("simple-html-tokenizer", ["exports"], function (exports) {
  "use strict";

  var namedCharRefs = {
    Aacute: "Á", aacute: "á", Abreve: "Ă", abreve: "ă", ac: "∾", acd: "∿", acE: "∾̳", Acirc: "Â", acirc: "â", acute: "´", Acy: "А", acy: "а", AElig: "Æ", aelig: "æ", af: "\u2061", Afr: "𝔄", afr: "𝔞", Agrave: "À", agrave: "à", alefsym: "ℵ", aleph: "ℵ", Alpha: "Α", alpha: "α", Amacr: "Ā", amacr: "ā", amalg: "⨿", AMP: "&", amp: "&", And: "⩓", and: "∧", andand: "⩕", andd: "⩜", andslope: "⩘", andv: "⩚", ang: "∠", ange: "⦤", angle: "∠", angmsd: "∡", angmsdaa: "⦨", angmsdab: "⦩", angmsdac: "⦪", angmsdad: "⦫", angmsdae: "⦬", angmsdaf: "⦭", angmsdag: "⦮", angmsdah: "⦯", angrt: "∟", angrtvb: "⊾", angrtvbd: "⦝", angsph: "∢", angst: "Å", angzarr: "⍼", Aogon: "Ą", aogon: "ą", Aopf: "𝔸", aopf: "𝕒", ap: "≈", apacir: "⩯", apE: "⩰", ape: "≊", apid: "≋", apos: "'", ApplyFunction: "\u2061", approx: "≈", approxeq: "≊", Aring: "Å", aring: "å", Ascr: "𝒜", ascr: "𝒶", Assign: "≔", ast: "*", asymp: "≈", asympeq: "≍", Atilde: "Ã", atilde: "ã", Auml: "Ä", auml: "ä", awconint: "∳", awint: "⨑", backcong: "≌", backepsilon: "϶", backprime: "‵", backsim: "∽", backsimeq: "⋍", Backslash: "∖", Barv: "⫧", barvee: "⊽", Barwed: "⌆", barwed: "⌅", barwedge: "⌅", bbrk: "⎵", bbrktbrk: "⎶", bcong: "≌", Bcy: "Б", bcy: "б", bdquo: "„", becaus: "∵", Because: "∵", because: "∵", bemptyv: "⦰", bepsi: "϶", bernou: "ℬ", Bernoullis: "ℬ", Beta: "Β", beta: "β", beth: "ℶ", between: "≬", Bfr: "𝔅", bfr: "𝔟", bigcap: "⋂", bigcirc: "◯", bigcup: "⋃", bigodot: "⨀", bigoplus: "⨁", bigotimes: "⨂", bigsqcup: "⨆", bigstar: "★", bigtriangledown: "▽", bigtriangleup: "△", biguplus: "⨄", bigvee: "⋁", bigwedge: "⋀", bkarow: "⤍", blacklozenge: "⧫", blacksquare: "▪", blacktriangle: "▴", blacktriangledown: "▾", blacktriangleleft: "◂", blacktriangleright: "▸", blank: "␣", blk12: "▒", blk14: "░", blk34: "▓", block: "█", bne: "=⃥", bnequiv: "≡⃥", bNot: "⫭", bnot: "⌐", Bopf: "𝔹", bopf: "𝕓", bot: "⊥", bottom: "⊥", bowtie: "⋈", boxbox: "⧉", boxDL: "╗", boxDl: "╖", boxdL: "╕", boxdl: "┐", boxDR: "╔", boxDr: "╓", boxdR: "╒", boxdr: "┌", boxH: "═", boxh: "─", boxHD: "╦", boxHd: "╤", boxhD: "╥", boxhd: "┬", boxHU: "╩", boxHu: "╧", boxhU: "╨", boxhu: "┴", boxminus: "⊟", boxplus: "⊞", boxtimes: "⊠", boxUL: "╝", boxUl: "╜", boxuL: "╛", boxul: "┘", boxUR: "╚", boxUr: "╙", boxuR: "╘", boxur: "└", boxV: "║", boxv: "│", boxVH: "╬", boxVh: "╫", boxvH: "╪", boxvh: "┼", boxVL: "╣", boxVl: "╢", boxvL: "╡", boxvl: "┤", boxVR: "╠", boxVr: "╟", boxvR: "╞", boxvr: "├", bprime: "‵", Breve: "˘", breve: "˘", brvbar: "¦", Bscr: "ℬ", bscr: "𝒷", bsemi: "⁏", bsim: "∽", bsime: "⋍", bsol: "\\", bsolb: "⧅", bsolhsub: "⟈", bull: "•", bullet: "•", bump: "≎", bumpE: "⪮", bumpe: "≏", Bumpeq: "≎", bumpeq: "≏", Cacute: "Ć", cacute: "ć", Cap: "⋒", cap: "∩", capand: "⩄", capbrcup: "⩉", capcap: "⩋", capcup: "⩇", capdot: "⩀", CapitalDifferentialD: "ⅅ", caps: "∩︀", caret: "⁁", caron: "ˇ", Cayleys: "ℭ", ccaps: "⩍", Ccaron: "Č", ccaron: "č", Ccedil: "Ç", ccedil: "ç", Ccirc: "Ĉ", ccirc: "ĉ", Cconint: "∰", ccups: "⩌", ccupssm: "⩐", Cdot: "Ċ", cdot: "ċ", cedil: "¸", Cedilla: "¸", cemptyv: "⦲", cent: "¢", CenterDot: "·", centerdot: "·", Cfr: "ℭ", cfr: "𝔠", CHcy: "Ч", chcy: "ч", check: "✓", checkmark: "✓", Chi: "Χ", chi: "χ", cir: "○", circ: "ˆ", circeq: "≗", circlearrowleft: "↺", circlearrowright: "↻", circledast: "⊛", circledcirc: "⊚", circleddash: "⊝", CircleDot: "⊙", circledR: "®", circledS: "Ⓢ", CircleMinus: "⊖", CirclePlus: "⊕", CircleTimes: "⊗", cirE: "⧃", cire: "≗", cirfnint: "⨐", cirmid: "⫯", cirscir: "⧂", ClockwiseContourIntegral: "∲", CloseCurlyDoubleQuote: "”", CloseCurlyQuote: "’", clubs: "♣", clubsuit: "♣", Colon: "∷", colon: ":", Colone: "⩴", colone: "≔", coloneq: "≔", comma: ",", commat: "@", comp: "∁", compfn: "∘", complement: "∁", complexes: "ℂ", cong: "≅", congdot: "⩭", Congruent: "≡", Conint: "∯", conint: "∮", ContourIntegral: "∮", Copf: "ℂ", copf: "𝕔", coprod: "∐", Coproduct: "∐", COPY: "©", copy: "©", copysr: "℗", CounterClockwiseContourIntegral: "∳", crarr: "↵", Cross: "⨯", cross: "✗", Cscr: "𝒞", cscr: "𝒸", csub: "⫏", csube: "⫑", csup: "⫐", csupe: "⫒", ctdot: "⋯", cudarrl: "⤸", cudarrr: "⤵", cuepr: "⋞", cuesc: "⋟", cularr: "↶", cularrp: "⤽", Cup: "⋓", cup: "∪", cupbrcap: "⩈", CupCap: "≍", cupcap: "⩆", cupcup: "⩊", cupdot: "⊍", cupor: "⩅", cups: "∪︀", curarr: "↷", curarrm: "⤼", curlyeqprec: "⋞", curlyeqsucc: "⋟", curlyvee: "⋎", curlywedge: "⋏", curren: "¤", curvearrowleft: "↶", curvearrowright: "↷", cuvee: "⋎", cuwed: "⋏", cwconint: "∲", cwint: "∱", cylcty: "⌭", Dagger: "‡", dagger: "†", daleth: "ℸ", Darr: "↡", dArr: "⇓", darr: "↓", dash: "‐", Dashv: "⫤", dashv: "⊣", dbkarow: "⤏", dblac: "˝", Dcaron: "Ď", dcaron: "ď", Dcy: "Д", dcy: "д", DD: "ⅅ", dd: "ⅆ", ddagger: "‡", ddarr: "⇊", DDotrahd: "⤑", ddotseq: "⩷", deg: "°", Del: "∇", Delta: "Δ", delta: "δ", demptyv: "⦱", dfisht: "⥿", Dfr: "𝔇", dfr: "𝔡", dHar: "⥥", dharl: "⇃", dharr: "⇂", DiacriticalAcute: "´", DiacriticalDot: "˙", DiacriticalDoubleAcute: "˝", DiacriticalGrave: "`", DiacriticalTilde: "˜", diam: "⋄", Diamond: "⋄", diamond: "⋄", diamondsuit: "♦", diams: "♦", die: "¨", DifferentialD: "ⅆ", digamma: "ϝ", disin: "⋲", div: "÷", divide: "÷", divideontimes: "⋇", divonx: "⋇", DJcy: "Ђ", djcy: "ђ", dlcorn: "⌞", dlcrop: "⌍", dollar: "$", Dopf: "𝔻", dopf: "𝕕", Dot: "¨", dot: "˙", DotDot: "⃜", doteq: "≐", doteqdot: "≑", DotEqual: "≐", dotminus: "∸", dotplus: "∔", dotsquare: "⊡", doublebarwedge: "⌆", DoubleContourIntegral: "∯", DoubleDot: "¨", DoubleDownArrow: "⇓", DoubleLeftArrow: "⇐", DoubleLeftRightArrow: "⇔", DoubleLeftTee: "⫤", DoubleLongLeftArrow: "⟸", DoubleLongLeftRightArrow: "⟺", DoubleLongRightArrow: "⟹", DoubleRightArrow: "⇒", DoubleRightTee: "⊨", DoubleUpArrow: "⇑", DoubleUpDownArrow: "⇕", DoubleVerticalBar: "∥", DownArrow: "↓", Downarrow: "⇓", downarrow: "↓", DownArrowBar: "⤓", DownArrowUpArrow: "⇵", DownBreve: "̑", downdownarrows: "⇊", downharpoonleft: "⇃", downharpoonright: "⇂", DownLeftRightVector: "⥐", DownLeftTeeVector: "⥞", DownLeftVector: "↽", DownLeftVectorBar: "⥖", DownRightTeeVector: "⥟", DownRightVector: "⇁", DownRightVectorBar: "⥗", DownTee: "⊤", DownTeeArrow: "↧", drbkarow: "⤐", drcorn: "⌟", drcrop: "⌌", Dscr: "𝒟", dscr: "𝒹", DScy: "Ѕ", dscy: "ѕ", dsol: "⧶", Dstrok: "Đ", dstrok: "đ", dtdot: "⋱", dtri: "▿", dtrif: "▾", duarr: "⇵", duhar: "⥯", dwangle: "⦦", DZcy: "Џ", dzcy: "џ", dzigrarr: "⟿", Eacute: "É", eacute: "é", easter: "⩮", Ecaron: "Ě", ecaron: "ě", ecir: "≖", Ecirc: "Ê", ecirc: "ê", ecolon: "≕", Ecy: "Э", ecy: "э", eDDot: "⩷", Edot: "Ė", eDot: "≑", edot: "ė", ee: "ⅇ", efDot: "≒", Efr: "𝔈", efr: "𝔢", eg: "⪚", Egrave: "È", egrave: "è", egs: "⪖", egsdot: "⪘", el: "⪙", Element: "∈", elinters: "⏧", ell: "ℓ", els: "⪕", elsdot: "⪗", Emacr: "Ē", emacr: "ē", empty: "∅", emptyset: "∅", EmptySmallSquare: "◻", emptyv: "∅", EmptyVerySmallSquare: "▫", emsp: " ", emsp13: " ", emsp14: " ", ENG: "Ŋ", eng: "ŋ", ensp: " ", Eogon: "Ę", eogon: "ę", Eopf: "𝔼", eopf: "𝕖", epar: "⋕", eparsl: "⧣", eplus: "⩱", epsi: "ε", Epsilon: "Ε", epsilon: "ε", epsiv: "ϵ", eqcirc: "≖", eqcolon: "≕", eqsim: "≂", eqslantgtr: "⪖", eqslantless: "⪕", Equal: "⩵", equals: "=", EqualTilde: "≂", equest: "≟", Equilibrium: "⇌", equiv: "≡", equivDD: "⩸", eqvparsl: "⧥", erarr: "⥱", erDot: "≓", Escr: "ℰ", escr: "ℯ", esdot: "≐", Esim: "⩳", esim: "≂", Eta: "Η", eta: "η", ETH: "Ð", eth: "ð", Euml: "Ë", euml: "ë", euro: "€", excl: "!", exist: "∃", Exists: "∃", expectation: "ℰ", ExponentialE: "ⅇ", exponentiale: "ⅇ", fallingdotseq: "≒", Fcy: "Ф", fcy: "ф", female: "♀", ffilig: "ﬃ", fflig: "ﬀ", ffllig: "ﬄ", Ffr: "𝔉", ffr: "𝔣", filig: "ﬁ", FilledSmallSquare: "◼", FilledVerySmallSquare: "▪", fjlig: "fj", flat: "♭", fllig: "ﬂ", fltns: "▱", fnof: "ƒ", Fopf: "𝔽", fopf: "𝕗", ForAll: "∀", forall: "∀", fork: "⋔", forkv: "⫙", Fouriertrf: "ℱ", fpartint: "⨍", frac12: "½", frac13: "⅓", frac14: "¼", frac15: "⅕", frac16: "⅙", frac18: "⅛", frac23: "⅔", frac25: "⅖", frac34: "¾", frac35: "⅗", frac38: "⅜", frac45: "⅘", frac56: "⅚", frac58: "⅝", frac78: "⅞", frasl: "⁄", frown: "⌢", Fscr: "ℱ", fscr: "𝒻", gacute: "ǵ", Gamma: "Γ", gamma: "γ", Gammad: "Ϝ", gammad: "ϝ", gap: "⪆", Gbreve: "Ğ", gbreve: "ğ", Gcedil: "Ģ", Gcirc: "Ĝ", gcirc: "ĝ", Gcy: "Г", gcy: "г", Gdot: "Ġ", gdot: "ġ", gE: "≧", ge: "≥", gEl: "⪌", gel: "⋛", geq: "≥", geqq: "≧", geqslant: "⩾", ges: "⩾", gescc: "⪩", gesdot: "⪀", gesdoto: "⪂", gesdotol: "⪄", gesl: "⋛︀", gesles: "⪔", Gfr: "𝔊", gfr: "𝔤", Gg: "⋙", gg: "≫", ggg: "⋙", gimel: "ℷ", GJcy: "Ѓ", gjcy: "ѓ", gl: "≷", gla: "⪥", glE: "⪒", glj: "⪤", gnap: "⪊", gnapprox: "⪊", gnE: "≩", gne: "⪈", gneq: "⪈", gneqq: "≩", gnsim: "⋧", Gopf: "𝔾", gopf: "𝕘", grave: "`", GreaterEqual: "≥", GreaterEqualLess: "⋛", GreaterFullEqual: "≧", GreaterGreater: "⪢", GreaterLess: "≷", GreaterSlantEqual: "⩾", GreaterTilde: "≳", Gscr: "𝒢", gscr: "ℊ", gsim: "≳", gsime: "⪎", gsiml: "⪐", GT: ">", Gt: "≫", gt: ">", gtcc: "⪧", gtcir: "⩺", gtdot: "⋗", gtlPar: "⦕", gtquest: "⩼", gtrapprox: "⪆", gtrarr: "⥸", gtrdot: "⋗", gtreqless: "⋛", gtreqqless: "⪌", gtrless: "≷", gtrsim: "≳", gvertneqq: "≩︀", gvnE: "≩︀", Hacek: "ˇ", hairsp: " ", half: "½", hamilt: "ℋ", HARDcy: "Ъ", hardcy: "ъ", hArr: "⇔", harr: "↔", harrcir: "⥈", harrw: "↭", Hat: "^", hbar: "ℏ", Hcirc: "Ĥ", hcirc: "ĥ", hearts: "♥", heartsuit: "♥", hellip: "…", hercon: "⊹", Hfr: "ℌ", hfr: "𝔥", HilbertSpace: "ℋ", hksearow: "⤥", hkswarow: "⤦", hoarr: "⇿", homtht: "∻", hookleftarrow: "↩", hookrightarrow: "↪", Hopf: "ℍ", hopf: "𝕙", horbar: "―", HorizontalLine: "─", Hscr: "ℋ", hscr: "𝒽", hslash: "ℏ", Hstrok: "Ħ", hstrok: "ħ", HumpDownHump: "≎", HumpEqual: "≏", hybull: "⁃", hyphen: "‐", Iacute: "Í", iacute: "í", ic: "\u2063", Icirc: "Î", icirc: "î", Icy: "И", icy: "и", Idot: "İ", IEcy: "Е", iecy: "е", iexcl: "¡", iff: "⇔", Ifr: "ℑ", ifr: "𝔦", Igrave: "Ì", igrave: "ì", ii: "ⅈ", iiiint: "⨌", iiint: "∭", iinfin: "⧜", iiota: "℩", IJlig: "Ĳ", ijlig: "ĳ", Im: "ℑ", Imacr: "Ī", imacr: "ī", image: "ℑ", ImaginaryI: "ⅈ", imagline: "ℐ", imagpart: "ℑ", imath: "ı", imof: "⊷", imped: "Ƶ", Implies: "⇒", in: "∈", incare: "℅", infin: "∞", infintie: "⧝", inodot: "ı", Int: "∬", int: "∫", intcal: "⊺", integers: "ℤ", Integral: "∫", intercal: "⊺", Intersection: "⋂", intlarhk: "⨗", intprod: "⨼", InvisibleComma: "\u2063", InvisibleTimes: "\u2062", IOcy: "Ё", iocy: "ё", Iogon: "Į", iogon: "į", Iopf: "𝕀", iopf: "𝕚", Iota: "Ι", iota: "ι", iprod: "⨼", iquest: "¿", Iscr: "ℐ", iscr: "𝒾", isin: "∈", isindot: "⋵", isinE: "⋹", isins: "⋴", isinsv: "⋳", isinv: "∈", it: "\u2062", Itilde: "Ĩ", itilde: "ĩ", Iukcy: "І", iukcy: "і", Iuml: "Ï", iuml: "ï", Jcirc: "Ĵ", jcirc: "ĵ", Jcy: "Й", jcy: "й", Jfr: "𝔍", jfr: "𝔧", jmath: "ȷ", Jopf: "𝕁", jopf: "𝕛", Jscr: "𝒥", jscr: "𝒿", Jsercy: "Ј", jsercy: "ј", Jukcy: "Є", jukcy: "є", Kappa: "Κ", kappa: "κ", kappav: "ϰ", Kcedil: "Ķ", kcedil: "ķ", Kcy: "К", kcy: "к", Kfr: "𝔎", kfr: "𝔨", kgreen: "ĸ", KHcy: "Х", khcy: "х", KJcy: "Ќ", kjcy: "ќ", Kopf: "𝕂", kopf: "𝕜", Kscr: "𝒦", kscr: "𝓀", lAarr: "⇚", Lacute: "Ĺ", lacute: "ĺ", laemptyv: "⦴", lagran: "ℒ", Lambda: "Λ", lambda: "λ", Lang: "⟪", lang: "⟨", langd: "⦑", langle: "⟨", lap: "⪅", Laplacetrf: "ℒ", laquo: "«", Larr: "↞", lArr: "⇐", larr: "←", larrb: "⇤", larrbfs: "⤟", larrfs: "⤝", larrhk: "↩", larrlp: "↫", larrpl: "⤹", larrsim: "⥳", larrtl: "↢", lat: "⪫", lAtail: "⤛", latail: "⤙", late: "⪭", lates: "⪭︀", lBarr: "⤎", lbarr: "⤌", lbbrk: "❲", lbrace: "{", lbrack: "[", lbrke: "⦋", lbrksld: "⦏", lbrkslu: "⦍", Lcaron: "Ľ", lcaron: "ľ", Lcedil: "Ļ", lcedil: "ļ", lceil: "⌈", lcub: "{", Lcy: "Л", lcy: "л", ldca: "⤶", ldquo: "“", ldquor: "„", ldrdhar: "⥧", ldrushar: "⥋", ldsh: "↲", lE: "≦", le: "≤", LeftAngleBracket: "⟨", LeftArrow: "←", Leftarrow: "⇐", leftarrow: "←", LeftArrowBar: "⇤", LeftArrowRightArrow: "⇆", leftarrowtail: "↢", LeftCeiling: "⌈", LeftDoubleBracket: "⟦", LeftDownTeeVector: "⥡", LeftDownVector: "⇃", LeftDownVectorBar: "⥙", LeftFloor: "⌊", leftharpoondown: "↽", leftharpoonup: "↼", leftleftarrows: "⇇", LeftRightArrow: "↔", Leftrightarrow: "⇔", leftrightarrow: "↔", leftrightarrows: "⇆", leftrightharpoons: "⇋", leftrightsquigarrow: "↭", LeftRightVector: "⥎", LeftTee: "⊣", LeftTeeArrow: "↤", LeftTeeVector: "⥚", leftthreetimes: "⋋", LeftTriangle: "⊲", LeftTriangleBar: "⧏", LeftTriangleEqual: "⊴", LeftUpDownVector: "⥑", LeftUpTeeVector: "⥠", LeftUpVector: "↿", LeftUpVectorBar: "⥘", LeftVector: "↼", LeftVectorBar: "⥒", lEg: "⪋", leg: "⋚", leq: "≤", leqq: "≦", leqslant: "⩽", les: "⩽", lescc: "⪨", lesdot: "⩿", lesdoto: "⪁", lesdotor: "⪃", lesg: "⋚︀", lesges: "⪓", lessapprox: "⪅", lessdot: "⋖", lesseqgtr: "⋚", lesseqqgtr: "⪋", LessEqualGreater: "⋚", LessFullEqual: "≦", LessGreater: "≶", lessgtr: "≶", LessLess: "⪡", lesssim: "≲", LessSlantEqual: "⩽", LessTilde: "≲", lfisht: "⥼", lfloor: "⌊", Lfr: "𝔏", lfr: "𝔩", lg: "≶", lgE: "⪑", lHar: "⥢", lhard: "↽", lharu: "↼", lharul: "⥪", lhblk: "▄", LJcy: "Љ", ljcy: "љ", Ll: "⋘", ll: "≪", llarr: "⇇", llcorner: "⌞", Lleftarrow: "⇚", llhard: "⥫", lltri: "◺", Lmidot: "Ŀ", lmidot: "ŀ", lmoust: "⎰", lmoustache: "⎰", lnap: "⪉", lnapprox: "⪉", lnE: "≨", lne: "⪇", lneq: "⪇", lneqq: "≨", lnsim: "⋦", loang: "⟬", loarr: "⇽", lobrk: "⟦", LongLeftArrow: "⟵", Longleftarrow: "⟸", longleftarrow: "⟵", LongLeftRightArrow: "⟷", Longleftrightarrow: "⟺", longleftrightarrow: "⟷", longmapsto: "⟼", LongRightArrow: "⟶", Longrightarrow: "⟹", longrightarrow: "⟶", looparrowleft: "↫", looparrowright: "↬", lopar: "⦅", Lopf: "𝕃", lopf: "𝕝", loplus: "⨭", lotimes: "⨴", lowast: "∗", lowbar: "_", LowerLeftArrow: "↙", LowerRightArrow: "↘", loz: "◊", lozenge: "◊", lozf: "⧫", lpar: "(", lparlt: "⦓", lrarr: "⇆", lrcorner: "⌟", lrhar: "⇋", lrhard: "⥭", lrm: "\u200e", lrtri: "⊿", lsaquo: "‹", Lscr: "ℒ", lscr: "𝓁", Lsh: "↰", lsh: "↰", lsim: "≲", lsime: "⪍", lsimg: "⪏", lsqb: "[", lsquo: "‘", lsquor: "‚", Lstrok: "Ł", lstrok: "ł", LT: "<", Lt: "≪", lt: "<", ltcc: "⪦", ltcir: "⩹", ltdot: "⋖", lthree: "⋋", ltimes: "⋉", ltlarr: "⥶", ltquest: "⩻", ltri: "◃", ltrie: "⊴", ltrif: "◂", ltrPar: "⦖", lurdshar: "⥊", luruhar: "⥦", lvertneqq: "≨︀", lvnE: "≨︀", macr: "¯", male: "♂", malt: "✠", maltese: "✠", Map: "⤅", map: "↦", mapsto: "↦", mapstodown: "↧", mapstoleft: "↤", mapstoup: "↥", marker: "▮", mcomma: "⨩", Mcy: "М", mcy: "м", mdash: "—", mDDot: "∺", measuredangle: "∡", MediumSpace: " ", Mellintrf: "ℳ", Mfr: "𝔐", mfr: "𝔪", mho: "℧", micro: "µ", mid: "∣", midast: "*", midcir: "⫰", middot: "·", minus: "−", minusb: "⊟", minusd: "∸", minusdu: "⨪", MinusPlus: "∓", mlcp: "⫛", mldr: "…", mnplus: "∓", models: "⊧", Mopf: "𝕄", mopf: "𝕞", mp: "∓", Mscr: "ℳ", mscr: "𝓂", mstpos: "∾", Mu: "Μ", mu: "μ", multimap: "⊸", mumap: "⊸", nabla: "∇", Nacute: "Ń", nacute: "ń", nang: "∠⃒", nap: "≉", napE: "⩰̸", napid: "≋̸", napos: "ŉ", napprox: "≉", natur: "♮", natural: "♮", naturals: "ℕ", nbsp: " ", nbump: "≎̸", nbumpe: "≏̸", ncap: "⩃", Ncaron: "Ň", ncaron: "ň", Ncedil: "Ņ", ncedil: "ņ", ncong: "≇", ncongdot: "⩭̸", ncup: "⩂", Ncy: "Н", ncy: "н", ndash: "–", ne: "≠", nearhk: "⤤", neArr: "⇗", nearr: "↗", nearrow: "↗", nedot: "≐̸", NegativeMediumSpace: "​", NegativeThickSpace: "​", NegativeThinSpace: "​", NegativeVeryThinSpace: "​", nequiv: "≢", nesear: "⤨", nesim: "≂̸", NestedGreaterGreater: "≫", NestedLessLess: "≪", NewLine: "\u000a", nexist: "∄", nexists: "∄", Nfr: "𝔑", nfr: "𝔫", ngE: "≧̸", nge: "≱", ngeq: "≱", ngeqq: "≧̸", ngeqslant: "⩾̸", nges: "⩾̸", nGg: "⋙̸", ngsim: "≵", nGt: "≫⃒", ngt: "≯", ngtr: "≯", nGtv: "≫̸", nhArr: "⇎", nharr: "↮", nhpar: "⫲", ni: "∋", nis: "⋼", nisd: "⋺", niv: "∋", NJcy: "Њ", njcy: "њ", nlArr: "⇍", nlarr: "↚", nldr: "‥", nlE: "≦̸", nle: "≰", nLeftarrow: "⇍", nleftarrow: "↚", nLeftrightarrow: "⇎", nleftrightarrow: "↮", nleq: "≰", nleqq: "≦̸", nleqslant: "⩽̸", nles: "⩽̸", nless: "≮", nLl: "⋘̸", nlsim: "≴", nLt: "≪⃒", nlt: "≮", nltri: "⋪", nltrie: "⋬", nLtv: "≪̸", nmid: "∤", NoBreak: "\u2060", NonBreakingSpace: " ", Nopf: "ℕ", nopf: "𝕟", Not: "⫬", not: "¬", NotCongruent: "≢", NotCupCap: "≭", NotDoubleVerticalBar: "∦", NotElement: "∉", NotEqual: "≠", NotEqualTilde: "≂̸", NotExists: "∄", NotGreater: "≯", NotGreaterEqual: "≱", NotGreaterFullEqual: "≧̸", NotGreaterGreater: "≫̸", NotGreaterLess: "≹", NotGreaterSlantEqual: "⩾̸", NotGreaterTilde: "≵", NotHumpDownHump: "≎̸", NotHumpEqual: "≏̸", notin: "∉", notindot: "⋵̸", notinE: "⋹̸", notinva: "∉", notinvb: "⋷", notinvc: "⋶", NotLeftTriangle: "⋪", NotLeftTriangleBar: "⧏̸", NotLeftTriangleEqual: "⋬", NotLess: "≮", NotLessEqual: "≰", NotLessGreater: "≸", NotLessLess: "≪̸", NotLessSlantEqual: "⩽̸", NotLessTilde: "≴", NotNestedGreaterGreater: "⪢̸", NotNestedLessLess: "⪡̸", notni: "∌", notniva: "∌", notnivb: "⋾", notnivc: "⋽", NotPrecedes: "⊀", NotPrecedesEqual: "⪯̸", NotPrecedesSlantEqual: "⋠", NotReverseElement: "∌", NotRightTriangle: "⋫", NotRightTriangleBar: "⧐̸", NotRightTriangleEqual: "⋭", NotSquareSubset: "⊏̸", NotSquareSubsetEqual: "⋢", NotSquareSuperset: "⊐̸", NotSquareSupersetEqual: "⋣", NotSubset: "⊂⃒", NotSubsetEqual: "⊈", NotSucceeds: "⊁", NotSucceedsEqual: "⪰̸", NotSucceedsSlantEqual: "⋡", NotSucceedsTilde: "≿̸", NotSuperset: "⊃⃒", NotSupersetEqual: "⊉", NotTilde: "≁", NotTildeEqual: "≄", NotTildeFullEqual: "≇", NotTildeTilde: "≉", NotVerticalBar: "∤", npar: "∦", nparallel: "∦", nparsl: "⫽⃥", npart: "∂̸", npolint: "⨔", npr: "⊀", nprcue: "⋠", npre: "⪯̸", nprec: "⊀", npreceq: "⪯̸", nrArr: "⇏", nrarr: "↛", nrarrc: "⤳̸", nrarrw: "↝̸", nRightarrow: "⇏", nrightarrow: "↛", nrtri: "⋫", nrtrie: "⋭", nsc: "⊁", nsccue: "⋡", nsce: "⪰̸", Nscr: "𝒩", nscr: "𝓃", nshortmid: "∤", nshortparallel: "∦", nsim: "≁", nsime: "≄", nsimeq: "≄", nsmid: "∤", nspar: "∦", nsqsube: "⋢", nsqsupe: "⋣", nsub: "⊄", nsubE: "⫅̸", nsube: "⊈", nsubset: "⊂⃒", nsubseteq: "⊈", nsubseteqq: "⫅̸", nsucc: "⊁", nsucceq: "⪰̸", nsup: "⊅", nsupE: "⫆̸", nsupe: "⊉", nsupset: "⊃⃒", nsupseteq: "⊉", nsupseteqq: "⫆̸", ntgl: "≹", Ntilde: "Ñ", ntilde: "ñ", ntlg: "≸", ntriangleleft: "⋪", ntrianglelefteq: "⋬", ntriangleright: "⋫", ntrianglerighteq: "⋭", Nu: "Ν", nu: "ν", num: "#", numero: "№", numsp: " ", nvap: "≍⃒", nVDash: "⊯", nVdash: "⊮", nvDash: "⊭", nvdash: "⊬", nvge: "≥⃒", nvgt: ">⃒", nvHarr: "⤄", nvinfin: "⧞", nvlArr: "⤂", nvle: "≤⃒", nvlt: "<⃒", nvltrie: "⊴⃒", nvrArr: "⤃", nvrtrie: "⊵⃒", nvsim: "∼⃒", nwarhk: "⤣", nwArr: "⇖", nwarr: "↖", nwarrow: "↖", nwnear: "⤧", Oacute: "Ó", oacute: "ó", oast: "⊛", ocir: "⊚", Ocirc: "Ô", ocirc: "ô", Ocy: "О", ocy: "о", odash: "⊝", Odblac: "Ő", odblac: "ő", odiv: "⨸", odot: "⊙", odsold: "⦼", OElig: "Œ", oelig: "œ", ofcir: "⦿", Ofr: "𝔒", ofr: "𝔬", ogon: "˛", Ograve: "Ò", ograve: "ò", ogt: "⧁", ohbar: "⦵", ohm: "Ω", oint: "∮", olarr: "↺", olcir: "⦾", olcross: "⦻", oline: "‾", olt: "⧀", Omacr: "Ō", omacr: "ō", Omega: "Ω", omega: "ω", Omicron: "Ο", omicron: "ο", omid: "⦶", ominus: "⊖", Oopf: "𝕆", oopf: "𝕠", opar: "⦷", OpenCurlyDoubleQuote: "“", OpenCurlyQuote: "‘", operp: "⦹", oplus: "⊕", Or: "⩔", or: "∨", orarr: "↻", ord: "⩝", order: "ℴ", orderof: "ℴ", ordf: "ª", ordm: "º", origof: "⊶", oror: "⩖", orslope: "⩗", orv: "⩛", oS: "Ⓢ", Oscr: "𝒪", oscr: "ℴ", Oslash: "Ø", oslash: "ø", osol: "⊘", Otilde: "Õ", otilde: "õ", Otimes: "⨷", otimes: "⊗", otimesas: "⨶", Ouml: "Ö", ouml: "ö", ovbar: "⌽", OverBar: "‾", OverBrace: "⏞", OverBracket: "⎴", OverParenthesis: "⏜", par: "∥", para: "¶", parallel: "∥", parsim: "⫳", parsl: "⫽", part: "∂", PartialD: "∂", Pcy: "П", pcy: "п", percnt: "%", period: ".", permil: "‰", perp: "⊥", pertenk: "‱", Pfr: "𝔓", pfr: "𝔭", Phi: "Φ", phi: "φ", phiv: "ϕ", phmmat: "ℳ", phone: "☎", Pi: "Π", pi: "π", pitchfork: "⋔", piv: "ϖ", planck: "ℏ", planckh: "ℎ", plankv: "ℏ", plus: "+", plusacir: "⨣", plusb: "⊞", pluscir: "⨢", plusdo: "∔", plusdu: "⨥", pluse: "⩲", PlusMinus: "±", plusmn: "±", plussim: "⨦", plustwo: "⨧", pm: "±", Poincareplane: "ℌ", pointint: "⨕", Popf: "ℙ", popf: "𝕡", pound: "£", Pr: "⪻", pr: "≺", prap: "⪷", prcue: "≼", prE: "⪳", pre: "⪯", prec: "≺", precapprox: "⪷", preccurlyeq: "≼", Precedes: "≺", PrecedesEqual: "⪯", PrecedesSlantEqual: "≼", PrecedesTilde: "≾", preceq: "⪯", precnapprox: "⪹", precneqq: "⪵", precnsim: "⋨", precsim: "≾", Prime: "″", prime: "′", primes: "ℙ", prnap: "⪹", prnE: "⪵", prnsim: "⋨", prod: "∏", Product: "∏", profalar: "⌮", profline: "⌒", profsurf: "⌓", prop: "∝", Proportion: "∷", Proportional: "∝", propto: "∝", prsim: "≾", prurel: "⊰", Pscr: "𝒫", pscr: "𝓅", Psi: "Ψ", psi: "ψ", puncsp: " ", Qfr: "𝔔", qfr: "𝔮", qint: "⨌", Qopf: "ℚ", qopf: "𝕢", qprime: "⁗", Qscr: "𝒬", qscr: "𝓆", quaternions: "ℍ", quatint: "⨖", quest: "?", questeq: "≟", QUOT: "\"", quot: "\"", rAarr: "⇛", race: "∽̱", Racute: "Ŕ", racute: "ŕ", radic: "√", raemptyv: "⦳", Rang: "⟫", rang: "⟩", rangd: "⦒", range: "⦥", rangle: "⟩", raquo: "»", Rarr: "↠", rArr: "⇒", rarr: "→", rarrap: "⥵", rarrb: "⇥", rarrbfs: "⤠", rarrc: "⤳", rarrfs: "⤞", rarrhk: "↪", rarrlp: "↬", rarrpl: "⥅", rarrsim: "⥴", Rarrtl: "⤖", rarrtl: "↣", rarrw: "↝", rAtail: "⤜", ratail: "⤚", ratio: "∶", rationals: "ℚ", RBarr: "⤐", rBarr: "⤏", rbarr: "⤍", rbbrk: "❳", rbrace: "}", rbrack: "]", rbrke: "⦌", rbrksld: "⦎", rbrkslu: "⦐", Rcaron: "Ř", rcaron: "ř", Rcedil: "Ŗ", rcedil: "ŗ", rceil: "⌉", rcub: "}", Rcy: "Р", rcy: "р", rdca: "⤷", rdldhar: "⥩", rdquo: "”", rdquor: "”", rdsh: "↳", Re: "ℜ", real: "ℜ", realine: "ℛ", realpart: "ℜ", reals: "ℝ", rect: "▭", REG: "®", reg: "®", ReverseElement: "∋", ReverseEquilibrium: "⇋", ReverseUpEquilibrium: "⥯", rfisht: "⥽", rfloor: "⌋", Rfr: "ℜ", rfr: "𝔯", rHar: "⥤", rhard: "⇁", rharu: "⇀", rharul: "⥬", Rho: "Ρ", rho: "ρ", rhov: "ϱ", RightAngleBracket: "⟩", RightArrow: "→", Rightarrow: "⇒", rightarrow: "→", RightArrowBar: "⇥", RightArrowLeftArrow: "⇄", rightarrowtail: "↣", RightCeiling: "⌉", RightDoubleBracket: "⟧", RightDownTeeVector: "⥝", RightDownVector: "⇂", RightDownVectorBar: "⥕", RightFloor: "⌋", rightharpoondown: "⇁", rightharpoonup: "⇀", rightleftarrows: "⇄", rightleftharpoons: "⇌", rightrightarrows: "⇉", rightsquigarrow: "↝", RightTee: "⊢", RightTeeArrow: "↦", RightTeeVector: "⥛", rightthreetimes: "⋌", RightTriangle: "⊳", RightTriangleBar: "⧐", RightTriangleEqual: "⊵", RightUpDownVector: "⥏", RightUpTeeVector: "⥜", RightUpVector: "↾", RightUpVectorBar: "⥔", RightVector: "⇀", RightVectorBar: "⥓", ring: "˚", risingdotseq: "≓", rlarr: "⇄", rlhar: "⇌", rlm: "\u200f", rmoust: "⎱", rmoustache: "⎱", rnmid: "⫮", roang: "⟭", roarr: "⇾", robrk: "⟧", ropar: "⦆", Ropf: "ℝ", ropf: "𝕣", roplus: "⨮", rotimes: "⨵", RoundImplies: "⥰", rpar: ")", rpargt: "⦔", rppolint: "⨒", rrarr: "⇉", Rrightarrow: "⇛", rsaquo: "›", Rscr: "ℛ", rscr: "𝓇", Rsh: "↱", rsh: "↱", rsqb: "]", rsquo: "’", rsquor: "’", rthree: "⋌", rtimes: "⋊", rtri: "▹", rtrie: "⊵", rtrif: "▸", rtriltri: "⧎", RuleDelayed: "⧴", ruluhar: "⥨", rx: "℞", Sacute: "Ś", sacute: "ś", sbquo: "‚", Sc: "⪼", sc: "≻", scap: "⪸", Scaron: "Š", scaron: "š", sccue: "≽", scE: "⪴", sce: "⪰", Scedil: "Ş", scedil: "ş", Scirc: "Ŝ", scirc: "ŝ", scnap: "⪺", scnE: "⪶", scnsim: "⋩", scpolint: "⨓", scsim: "≿", Scy: "С", scy: "с", sdot: "⋅", sdotb: "⊡", sdote: "⩦", searhk: "⤥", seArr: "⇘", searr: "↘", searrow: "↘", sect: "§", semi: ";", seswar: "⤩", setminus: "∖", setmn: "∖", sext: "✶", Sfr: "𝔖", sfr: "𝔰", sfrown: "⌢", sharp: "♯", SHCHcy: "Щ", shchcy: "щ", SHcy: "Ш", shcy: "ш", ShortDownArrow: "↓", ShortLeftArrow: "←", shortmid: "∣", shortparallel: "∥", ShortRightArrow: "→", ShortUpArrow: "↑", shy: "\u00ad", Sigma: "Σ", sigma: "σ", sigmaf: "ς", sigmav: "ς", sim: "∼", simdot: "⩪", sime: "≃", simeq: "≃", simg: "⪞", simgE: "⪠", siml: "⪝", simlE: "⪟", simne: "≆", simplus: "⨤", simrarr: "⥲", slarr: "←", SmallCircle: "∘", smallsetminus: "∖", smashp: "⨳", smeparsl: "⧤", smid: "∣", smile: "⌣", smt: "⪪", smte: "⪬", smtes: "⪬︀", SOFTcy: "Ь", softcy: "ь", sol: "/", solb: "⧄", solbar: "⌿", Sopf: "𝕊", sopf: "𝕤", spades: "♠", spadesuit: "♠", spar: "∥", sqcap: "⊓", sqcaps: "⊓︀", sqcup: "⊔", sqcups: "⊔︀", Sqrt: "√", sqsub: "⊏", sqsube: "⊑", sqsubset: "⊏", sqsubseteq: "⊑", sqsup: "⊐", sqsupe: "⊒", sqsupset: "⊐", sqsupseteq: "⊒", squ: "□", Square: "□", square: "□", SquareIntersection: "⊓", SquareSubset: "⊏", SquareSubsetEqual: "⊑", SquareSuperset: "⊐", SquareSupersetEqual: "⊒", SquareUnion: "⊔", squarf: "▪", squf: "▪", srarr: "→", Sscr: "𝒮", sscr: "𝓈", ssetmn: "∖", ssmile: "⌣", sstarf: "⋆", Star: "⋆", star: "☆", starf: "★", straightepsilon: "ϵ", straightphi: "ϕ", strns: "¯", Sub: "⋐", sub: "⊂", subdot: "⪽", subE: "⫅", sube: "⊆", subedot: "⫃", submult: "⫁", subnE: "⫋", subne: "⊊", subplus: "⪿", subrarr: "⥹", Subset: "⋐", subset: "⊂", subseteq: "⊆", subseteqq: "⫅", SubsetEqual: "⊆", subsetneq: "⊊", subsetneqq: "⫋", subsim: "⫇", subsub: "⫕", subsup: "⫓", succ: "≻", succapprox: "⪸", succcurlyeq: "≽", Succeeds: "≻", SucceedsEqual: "⪰", SucceedsSlantEqual: "≽", SucceedsTilde: "≿", succeq: "⪰", succnapprox: "⪺", succneqq: "⪶", succnsim: "⋩", succsim: "≿", SuchThat: "∋", Sum: "∑", sum: "∑", sung: "♪", Sup: "⋑", sup: "⊃", sup1: "¹", sup2: "²", sup3: "³", supdot: "⪾", supdsub: "⫘", supE: "⫆", supe: "⊇", supedot: "⫄", Superset: "⊃", SupersetEqual: "⊇", suphsol: "⟉", suphsub: "⫗", suplarr: "⥻", supmult: "⫂", supnE: "⫌", supne: "⊋", supplus: "⫀", Supset: "⋑", supset: "⊃", supseteq: "⊇", supseteqq: "⫆", supsetneq: "⊋", supsetneqq: "⫌", supsim: "⫈", supsub: "⫔", supsup: "⫖", swarhk: "⤦", swArr: "⇙", swarr: "↙", swarrow: "↙", swnwar: "⤪", szlig: "ß", Tab: "\u0009", target: "⌖", Tau: "Τ", tau: "τ", tbrk: "⎴", Tcaron: "Ť", tcaron: "ť", Tcedil: "Ţ", tcedil: "ţ", Tcy: "Т", tcy: "т", tdot: "⃛", telrec: "⌕", Tfr: "𝔗", tfr: "𝔱", there4: "∴", Therefore: "∴", therefore: "∴", Theta: "Θ", theta: "θ", thetasym: "ϑ", thetav: "ϑ", thickapprox: "≈", thicksim: "∼", ThickSpace: "  ", thinsp: " ", ThinSpace: " ", thkap: "≈", thksim: "∼", THORN: "Þ", thorn: "þ", Tilde: "∼", tilde: "˜", TildeEqual: "≃", TildeFullEqual: "≅", TildeTilde: "≈", times: "×", timesb: "⊠", timesbar: "⨱", timesd: "⨰", tint: "∭", toea: "⤨", top: "⊤", topbot: "⌶", topcir: "⫱", Topf: "𝕋", topf: "𝕥", topfork: "⫚", tosa: "⤩", tprime: "‴", TRADE: "™", trade: "™", triangle: "▵", triangledown: "▿", triangleleft: "◃", trianglelefteq: "⊴", triangleq: "≜", triangleright: "▹", trianglerighteq: "⊵", tridot: "◬", trie: "≜", triminus: "⨺", TripleDot: "⃛", triplus: "⨹", trisb: "⧍", tritime: "⨻", trpezium: "⏢", Tscr: "𝒯", tscr: "𝓉", TScy: "Ц", tscy: "ц", TSHcy: "Ћ", tshcy: "ћ", Tstrok: "Ŧ", tstrok: "ŧ", twixt: "≬", twoheadleftarrow: "↞", twoheadrightarrow: "↠", Uacute: "Ú", uacute: "ú", Uarr: "↟", uArr: "⇑", uarr: "↑", Uarrocir: "⥉", Ubrcy: "Ў", ubrcy: "ў", Ubreve: "Ŭ", ubreve: "ŭ", Ucirc: "Û", ucirc: "û", Ucy: "У", ucy: "у", udarr: "⇅", Udblac: "Ű", udblac: "ű", udhar: "⥮", ufisht: "⥾", Ufr: "𝔘", ufr: "𝔲", Ugrave: "Ù", ugrave: "ù", uHar: "⥣", uharl: "↿", uharr: "↾", uhblk: "▀", ulcorn: "⌜", ulcorner: "⌜", ulcrop: "⌏", ultri: "◸", Umacr: "Ū", umacr: "ū", uml: "¨", UnderBar: "_", UnderBrace: "⏟", UnderBracket: "⎵", UnderParenthesis: "⏝", Union: "⋃", UnionPlus: "⊎", Uogon: "Ų", uogon: "ų", Uopf: "𝕌", uopf: "𝕦", UpArrow: "↑", Uparrow: "⇑", uparrow: "↑", UpArrowBar: "⤒", UpArrowDownArrow: "⇅", UpDownArrow: "↕", Updownarrow: "⇕", updownarrow: "↕", UpEquilibrium: "⥮", upharpoonleft: "↿", upharpoonright: "↾", uplus: "⊎", UpperLeftArrow: "↖", UpperRightArrow: "↗", Upsi: "ϒ", upsi: "υ", upsih: "ϒ", Upsilon: "Υ", upsilon: "υ", UpTee: "⊥", UpTeeArrow: "↥", upuparrows: "⇈", urcorn: "⌝", urcorner: "⌝", urcrop: "⌎", Uring: "Ů", uring: "ů", urtri: "◹", Uscr: "𝒰", uscr: "𝓊", utdot: "⋰", Utilde: "Ũ", utilde: "ũ", utri: "▵", utrif: "▴", uuarr: "⇈", Uuml: "Ü", uuml: "ü", uwangle: "⦧", vangrt: "⦜", varepsilon: "ϵ", varkappa: "ϰ", varnothing: "∅", varphi: "ϕ", varpi: "ϖ", varpropto: "∝", vArr: "⇕", varr: "↕", varrho: "ϱ", varsigma: "ς", varsubsetneq: "⊊︀", varsubsetneqq: "⫋︀", varsupsetneq: "⊋︀", varsupsetneqq: "⫌︀", vartheta: "ϑ", vartriangleleft: "⊲", vartriangleright: "⊳", Vbar: "⫫", vBar: "⫨", vBarv: "⫩", Vcy: "В", vcy: "в", VDash: "⊫", Vdash: "⊩", vDash: "⊨", vdash: "⊢", Vdashl: "⫦", Vee: "⋁", vee: "∨", veebar: "⊻", veeeq: "≚", vellip: "⋮", Verbar: "‖", verbar: "|", Vert: "‖", vert: "|", VerticalBar: "∣", VerticalLine: "|", VerticalSeparator: "❘", VerticalTilde: "≀", VeryThinSpace: " ", Vfr: "𝔙", vfr: "𝔳", vltri: "⊲", vnsub: "⊂⃒", vnsup: "⊃⃒", Vopf: "𝕍", vopf: "𝕧", vprop: "∝", vrtri: "⊳", Vscr: "𝒱", vscr: "𝓋", vsubnE: "⫋︀", vsubne: "⊊︀", vsupnE: "⫌︀", vsupne: "⊋︀", Vvdash: "⊪", vzigzag: "⦚", Wcirc: "Ŵ", wcirc: "ŵ", wedbar: "⩟", Wedge: "⋀", wedge: "∧", wedgeq: "≙", weierp: "℘", Wfr: "𝔚", wfr: "𝔴", Wopf: "𝕎", wopf: "𝕨", wp: "℘", wr: "≀", wreath: "≀", Wscr: "𝒲", wscr: "𝓌", xcap: "⋂", xcirc: "◯", xcup: "⋃", xdtri: "▽", Xfr: "𝔛", xfr: "𝔵", xhArr: "⟺", xharr: "⟷", Xi: "Ξ", xi: "ξ", xlArr: "⟸", xlarr: "⟵", xmap: "⟼", xnis: "⋻", xodot: "⨀", Xopf: "𝕏", xopf: "𝕩", xoplus: "⨁", xotime: "⨂", xrArr: "⟹", xrarr: "⟶", Xscr: "𝒳", xscr: "𝓍", xsqcup: "⨆", xuplus: "⨄", xutri: "△", xvee: "⋁", xwedge: "⋀", Yacute: "Ý", yacute: "ý", YAcy: "Я", yacy: "я", Ycirc: "Ŷ", ycirc: "ŷ", Ycy: "Ы", ycy: "ы", yen: "¥", Yfr: "𝔜", yfr: "𝔶", YIcy: "Ї", yicy: "ї", Yopf: "𝕐", yopf: "𝕪", Yscr: "𝒴", yscr: "𝓎", YUcy: "Ю", yucy: "ю", Yuml: "Ÿ", yuml: "ÿ", Zacute: "Ź", zacute: "ź", Zcaron: "Ž", zcaron: "ž", Zcy: "З", zcy: "з", Zdot: "Ż", zdot: "ż", zeetrf: "ℨ", ZeroWidthSpace: "​", Zeta: "Ζ", zeta: "ζ", Zfr: "ℨ", zfr: "𝔷", ZHcy: "Ж", zhcy: "ж", zigrarr: "⇝", Zopf: "ℤ", zopf: "𝕫", Zscr: "𝒵", zscr: "𝓏", zwj: "\u200d", zwnj: "\u200c"
  };

  function EntityParser(named) {
    this.named = named;
  }

  var HEXCHARCODE = /^#[xX]([A-Fa-f0-9]+)$/;
  var CHARCODE = /^#([0-9]+)$/;
  var NAMED = /^([A-Za-z0-9]+)$/;

  EntityParser.prototype.parse = function (entity) {
    if (!entity) {
      return;
    }
    var matches = entity.match(HEXCHARCODE);
    if (matches) {
      return String.fromCharCode(parseInt(matches[1], 16));
    }
    matches = entity.match(CHARCODE);
    if (matches) {
      return String.fromCharCode(parseInt(matches[1], 10));
    }
    matches = entity.match(NAMED);
    if (matches) {
      return this.named[matches[1]];
    }
  };

  var WSP = /[\t\n\f ]/;
  var ALPHA = /[A-Za-z]/;
  var CRLF = /\r\n?/g;

  function isSpace(char) {
    return WSP.test(char);
  }

  function isAlpha(char) {
    return ALPHA.test(char);
  }

  function preprocessInput(input) {
    return input.replace(CRLF, "\n");
  }

  function EventedTokenizer(delegate, entityParser) {
    this.delegate = delegate;
    this.entityParser = entityParser;

    this.state = null;
    this.input = null;

    this.index = -1;
    this.line = -1;
    this.column = -1;
    this.tagLine = -1;
    this.tagColumn = -1;

    this.reset();
  }

  EventedTokenizer.prototype = {
    reset: function () {
      this.state = 'beforeData';
      this.input = '';

      this.index = 0;
      this.line = 1;
      this.column = 0;

      this.tagLine = -1;
      this.tagColumn = -1;

      this.delegate.reset();
    },

    tokenize: function (input) {
      this.reset();
      this.tokenizePart(input);
      this.tokenizeEOF();
    },

    tokenizePart: function (input) {
      this.input += preprocessInput(input);

      while (this.index < this.input.length) {
        this.states[this.state].call(this);
      }
    },

    tokenizeEOF: function () {
      this.flushData();
    },

    flushData: function () {
      if (this.state === 'data') {
        this.delegate.finishData();
        this.state = 'beforeData';
      }
    },

    peek: function () {
      return this.input.charAt(this.index);
    },

    consume: function () {
      var char = this.peek();

      this.index++;

      if (char === "\n") {
        this.line++;
        this.column = 0;
      } else {
        this.column++;
      }

      return char;
    },

    consumeCharRef: function () {
      var endIndex = this.input.indexOf(';', this.index);
      if (endIndex === -1) {
        return;
      }
      var entity = this.input.slice(this.index, endIndex);
      var chars = this.entityParser.parse(entity);
      if (chars) {
        var count = entity.length;
        // consume the entity chars
        while (count) {
          this.consume();
          count--;
        }
        // consume the `;`
        this.consume();

        return chars;
      }
    },

    markTagStart: function () {
      // these properties to be removed in next major bump
      this.tagLine = this.line;
      this.tagColumn = this.column;

      if (this.delegate.tagOpen) {
        this.delegate.tagOpen();
      }
    },

    states: {
      beforeData: function () {
        var char = this.peek();

        if (char === "<") {
          this.state = 'tagOpen';
          this.markTagStart();
          this.consume();
        } else {
          this.state = 'data';
          this.delegate.beginData();
        }
      },

      data: function () {
        var char = this.peek();

        if (char === "<") {
          this.delegate.finishData();
          this.state = 'tagOpen';
          this.markTagStart();
          this.consume();
        } else if (char === "&") {
          this.consume();
          this.delegate.appendToData(this.consumeCharRef() || "&");
        } else {
          this.consume();
          this.delegate.appendToData(char);
        }
      },

      tagOpen: function () {
        var char = this.consume();

        if (char === "!") {
          this.state = 'markupDeclaration';
        } else if (char === "/") {
          this.state = 'endTagOpen';
        } else if (isAlpha(char)) {
          this.state = 'tagName';
          this.delegate.beginStartTag();
          this.delegate.appendToTagName(char.toLowerCase());
        }
      },

      markupDeclaration: function () {
        var char = this.consume();

        if (char === "-" && this.input.charAt(this.index) === "-") {
          this.consume();
          this.state = 'commentStart';
          this.delegate.beginComment();
        }
      },

      commentStart: function () {
        var char = this.consume();

        if (char === "-") {
          this.state = 'commentStartDash';
        } else if (char === ">") {
          this.delegate.finishComment();
          this.state = 'beforeData';
        } else {
          this.delegate.appendToCommentData(char);
          this.state = 'comment';
        }
      },

      commentStartDash: function () {
        var char = this.consume();

        if (char === "-") {
          this.state = 'commentEnd';
        } else if (char === ">") {
          this.delegate.finishComment();
          this.state = 'beforeData';
        } else {
          this.delegate.appendToCommentData("-");
          this.state = 'comment';
        }
      },

      comment: function () {
        var char = this.consume();

        if (char === "-") {
          this.state = 'commentEndDash';
        } else {
          this.delegate.appendToCommentData(char);
        }
      },

      commentEndDash: function () {
        var char = this.consume();

        if (char === "-") {
          this.state = 'commentEnd';
        } else {
          this.delegate.appendToCommentData("-" + char);
          this.state = 'comment';
        }
      },

      commentEnd: function () {
        var char = this.consume();

        if (char === ">") {
          this.delegate.finishComment();
          this.state = 'beforeData';
        } else {
          this.delegate.appendToCommentData("--" + char);
          this.state = 'comment';
        }
      },

      tagName: function () {
        var char = this.consume();

        if (isSpace(char)) {
          this.state = 'beforeAttributeName';
        } else if (char === "/") {
          this.state = 'selfClosingStartTag';
        } else if (char === ">") {
          this.delegate.finishTag();
          this.state = 'beforeData';
        } else {
          this.delegate.appendToTagName(char);
        }
      },

      beforeAttributeName: function () {
        var char = this.peek();

        if (isSpace(char)) {
          this.consume();
          return;
        } else if (char === "/") {
          this.state = 'selfClosingStartTag';
          this.consume();
        } else if (char === ">") {
          this.consume();
          this.delegate.finishTag();
          this.state = 'beforeData';
        } else if (char === '=') {
          this.delegate.reportSyntaxError("attribute name cannot start with equals sign");
          this.state = 'attributeName';
          this.delegate.beginAttribute();
          this.consume();
          this.delegate.appendToAttributeName(char);
        } else {
          this.state = 'attributeName';
          this.delegate.beginAttribute();
        }
      },

      attributeName: function () {
        var char = this.peek();

        if (isSpace(char)) {
          this.state = 'afterAttributeName';
          this.consume();
        } else if (char === "/") {
          this.delegate.beginAttributeValue(false);
          this.delegate.finishAttributeValue();
          this.consume();
          this.state = 'selfClosingStartTag';
        } else if (char === "=") {
          this.state = 'beforeAttributeValue';
          this.consume();
        } else if (char === ">") {
          this.delegate.beginAttributeValue(false);
          this.delegate.finishAttributeValue();
          this.consume();
          this.delegate.finishTag();
          this.state = 'beforeData';
        } else if (char === '"' || char === "'" || char === '<') {
          this.delegate.reportSyntaxError(char + " is not a valid character within attribute names");
          this.consume();
          this.delegate.appendToAttributeName(char);
        } else {
          this.consume();
          this.delegate.appendToAttributeName(char);
        }
      },

      afterAttributeName: function () {
        var char = this.peek();

        if (isSpace(char)) {
          this.consume();
          return;
        } else if (char === "/") {
          this.delegate.beginAttributeValue(false);
          this.delegate.finishAttributeValue();
          this.consume();
          this.state = 'selfClosingStartTag';
        } else if (char === "=") {
          this.consume();
          this.state = 'beforeAttributeValue';
        } else if (char === ">") {
          this.delegate.beginAttributeValue(false);
          this.delegate.finishAttributeValue();
          this.consume();
          this.delegate.finishTag();
          this.state = 'beforeData';
        } else {
          this.delegate.beginAttributeValue(false);
          this.delegate.finishAttributeValue();
          this.consume();
          this.state = 'attributeName';
          this.delegate.beginAttribute();
          this.delegate.appendToAttributeName(char);
        }
      },

      beforeAttributeValue: function () {
        var char = this.peek();

        if (isSpace(char)) {
          this.consume();
        } else if (char === '"') {
          this.state = 'attributeValueDoubleQuoted';
          this.delegate.beginAttributeValue(true);
          this.consume();
        } else if (char === "'") {
          this.state = 'attributeValueSingleQuoted';
          this.delegate.beginAttributeValue(true);
          this.consume();
        } else if (char === ">") {
          this.delegate.beginAttributeValue(false);
          this.delegate.finishAttributeValue();
          this.consume();
          this.delegate.finishTag();
          this.state = 'beforeData';
        } else {
          this.state = 'attributeValueUnquoted';
          this.delegate.beginAttributeValue(false);
          this.consume();
          this.delegate.appendToAttributeValue(char);
        }
      },

      attributeValueDoubleQuoted: function () {
        var char = this.consume();

        if (char === '"') {
          this.delegate.finishAttributeValue();
          this.state = 'afterAttributeValueQuoted';
        } else if (char === "&") {
          this.delegate.appendToAttributeValue(this.consumeCharRef('"') || "&");
        } else {
          this.delegate.appendToAttributeValue(char);
        }
      },

      attributeValueSingleQuoted: function () {
        var char = this.consume();

        if (char === "'") {
          this.delegate.finishAttributeValue();
          this.state = 'afterAttributeValueQuoted';
        } else if (char === "&") {
          this.delegate.appendToAttributeValue(this.consumeCharRef("'") || "&");
        } else {
          this.delegate.appendToAttributeValue(char);
        }
      },

      attributeValueUnquoted: function () {
        var char = this.peek();

        if (isSpace(char)) {
          this.delegate.finishAttributeValue();
          this.consume();
          this.state = 'beforeAttributeName';
        } else if (char === "&") {
          this.consume();
          this.delegate.appendToAttributeValue(this.consumeCharRef(">") || "&");
        } else if (char === ">") {
          this.delegate.finishAttributeValue();
          this.consume();
          this.delegate.finishTag();
          this.state = 'beforeData';
        } else {
          this.consume();
          this.delegate.appendToAttributeValue(char);
        }
      },

      afterAttributeValueQuoted: function () {
        var char = this.peek();

        if (isSpace(char)) {
          this.consume();
          this.state = 'beforeAttributeName';
        } else if (char === "/") {
          this.consume();
          this.state = 'selfClosingStartTag';
        } else if (char === ">") {
          this.consume();
          this.delegate.finishTag();
          this.state = 'beforeData';
        } else {
          this.state = 'beforeAttributeName';
        }
      },

      selfClosingStartTag: function () {
        var char = this.peek();

        if (char === ">") {
          this.consume();
          this.delegate.markTagAsSelfClosing();
          this.delegate.finishTag();
          this.state = 'beforeData';
        } else {
          this.state = 'beforeAttributeName';
        }
      },

      endTagOpen: function () {
        var char = this.consume();

        if (isAlpha(char)) {
          this.state = 'tagName';
          this.delegate.beginEndTag();
          this.delegate.appendToTagName(char.toLowerCase());
        }
      }
    }
  };

  function Tokenizer(entityParser, options) {
    this.token = null;
    this.startLine = 1;
    this.startColumn = 0;
    this.options = options || {};
    this.tokenizer = new EventedTokenizer(this, entityParser);
  }

  Tokenizer.prototype = {
    tokenize: function (input) {
      this.tokens = [];
      this.tokenizer.tokenize(input);
      return this.tokens;
    },

    tokenizePart: function (input) {
      this.tokens = [];
      this.tokenizer.tokenizePart(input);
      return this.tokens;
    },

    tokenizeEOF: function () {
      this.tokens = [];
      this.tokenizer.tokenizeEOF();
      return this.tokens[0];
    },

    reset: function () {
      this.token = null;
      this.startLine = 1;
      this.startColumn = 0;
    },

    addLocInfo: function () {
      if (this.options.loc) {
        this.token.loc = {
          start: {
            line: this.startLine,
            column: this.startColumn
          },
          end: {
            line: this.tokenizer.line,
            column: this.tokenizer.column
          }
        };
      }
      this.startLine = this.tokenizer.line;
      this.startColumn = this.tokenizer.column;
    },

    // Data

    beginData: function () {
      this.token = {
        type: 'Chars',
        chars: ''
      };
      this.tokens.push(this.token);
    },

    appendToData: function (char) {
      this.token.chars += char;
    },

    finishData: function () {
      this.addLocInfo();
    },

    // Comment

    beginComment: function () {
      this.token = {
        type: 'Comment',
        chars: ''
      };
      this.tokens.push(this.token);
    },

    appendToCommentData: function (char) {
      this.token.chars += char;
    },

    finishComment: function () {
      this.addLocInfo();
    },

    // Tags - basic

    beginStartTag: function () {
      this.token = {
        type: 'StartTag',
        tagName: '',
        attributes: [],
        selfClosing: false
      };
      this.tokens.push(this.token);
    },

    beginEndTag: function () {
      this.token = {
        type: 'EndTag',
        tagName: ''
      };
      this.tokens.push(this.token);
    },

    finishTag: function () {
      this.addLocInfo();
    },

    markTagAsSelfClosing: function () {
      this.token.selfClosing = true;
    },

    // Tags - name

    appendToTagName: function (char) {
      this.token.tagName += char;
    },

    // Tags - attributes

    beginAttribute: function () {
      this._currentAttribute = ["", "", null];
      this.token.attributes.push(this._currentAttribute);
    },

    appendToAttributeName: function (char) {
      this._currentAttribute[0] += char;
    },

    beginAttributeValue: function (isQuoted) {
      this._currentAttribute[2] = isQuoted;
    },

    appendToAttributeValue: function (char) {
      this._currentAttribute[1] = this._currentAttribute[1] || "";
      this._currentAttribute[1] += char;
    },

    finishAttributeValue: function () {},

    reportSyntaxError: function (message) {
      this.token.syntaxError = message;
    }
  };

  function tokenize(input, options) {
    var tokenizer = new Tokenizer(new EntityParser(namedCharRefs), options);
    return tokenizer.tokenize(input);
  }

  exports.HTML5NamedCharRefs = namedCharRefs;
  exports.EntityParser = EntityParser;
  exports.EventedTokenizer = EventedTokenizer;
  exports.Tokenizer = Tokenizer;
  exports.tokenize = tokenize;
});
(function (m) { if (typeof module === "object" && module.exports) { module.exports = m } }(requireModule("ember-template-compiler")));


}());
