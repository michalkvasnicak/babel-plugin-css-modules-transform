import { expect } from 'chai';

import camelCase from '../../src/options_resolvers/camelCase';

describe('options_resolvers/camelCase', () => {
    it('should throw if camelCase value is not a boolean', () => {
        expect(
            () => camelCase(null)
        ).to.throw();

        expect(camelCase(true)).to.be.equal(true);
    });
});
