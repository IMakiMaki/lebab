import extractComments from './extractComments';
import isEqualAst from './../../utils/isEqualAst';
import {matchesAst} from './../../utils/matchesAst';
import multiReplaceStatement from './../../utils/multiReplaceStatement';

/**
 * Represents a potential class method to be created.
 */
export default
class PotentialMethod {
  /**
   * @param {Object} cfg
   *   @param {String} cfg.name Method name
   *   @param {Object} cfg.methodNode
   *   @param {Object} cfg.fullNode Node to remove after converting to class
   *   @param {Object[]} cfg.commentNodes Nodes to extract comments from
   *   @param {Object} cfg.parent
   *   @param {String} cfg.kind Either 'get' or 'set' (optional)
   *   @param {Boolean} cfg.static True to make static method (optional)
   *   @param {PotentialClass} cfg.potentialClass The class the method is in
   */
  constructor(cfg) {
    this.name = cfg.name;
    this.methodNode = cfg.methodNode;
    this.fullNode = cfg.fullNode;
    this.commentNodes = cfg.commentNodes || [];
    this.parent = cfg.parent;
    this.kind = cfg.kind || 'method';
    this.static = cfg.static || false;
    this.potentialClass = cfg.potentialClass;
  }

  /**
   * True when method body is empty.
   * @return {Boolean}
   */
  isEmpty() {
    return this.methodNode.body.body.length === 0;
  }

  /**
   * Transforms the potential method to actual MethodDefinition node.
   * @return {MethodDefinition}
   */
  toMethodDefinition() {
    return {
      type: 'MethodDefinition',
      key: {
        type: 'Identifier',
        name: this.name,
      },
      computed: false,
      value: {
        type: 'FunctionExpression',
        params: this.methodNode.params,
        defaults: this.methodNode.defaults,
        body: this.getBody(),
        generator: false,
        expression: false,
      },
      kind: this.kind,
      static: this.static,
      comments: extractComments(this.commentNodes),
    };
  }

  /**
   * Removes original prototype assignment node from AST.
   */
  remove() {
    multiReplaceStatement({
      parent: this.parent,
      node: this.fullNode,
      replacements: [],
    });
  }

  getBody() {
    if (this.name === 'constructor') {
      return this.transformSuperCalls(this.methodNode.body);
    }
    else {
      return this.methodNode.body;
    }
  }

  // Transforms constructor body by replacing
  // SuperClass.call(this, ...args) --> super(...args)
  transformSuperCalls(body) {
    const matchSuperConstructorCall = matchesAst({
      type: 'ExpressionStatement',
      expression: {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: obj => isEqualAst(obj, this.potentialClass.superClass),
          property: {
            type: 'Identifier',
            name: 'call'
          }
        },
        arguments: [
          {
            type: 'ThisExpression'
          }
        ]
      }
    });

    body.body.forEach(node => {
      if (matchSuperConstructorCall(node)) {
        node.expression.callee = {
          type: 'Super'
        };
        node.expression.arguments = node.expression.arguments.slice(1);
      }
    });

    return body;
  }
}
