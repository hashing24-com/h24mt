import chai, {Assertion} from "chai";

chai.should();
chai.config.includeStack = true;
export const expect = chai.expect;


declare global {
  export namespace Chai {
    interface Assertion {
      near(val: BigInt): Assertion;
    }
  }
}

Assertion.addMethod('near', function (val: BigInt) {
  this.assert(
    Math.abs(this._obj.div(val).toNumber()) < (5 / 64800),
    "expected #{act} to be near #{exp}",
    "expected #{act} to not be near #{exp}",
    val,
    this._obj.toString());
});
