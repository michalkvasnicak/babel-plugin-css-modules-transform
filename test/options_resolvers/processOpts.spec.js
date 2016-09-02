import { expect } from 'chai';

import processOpts from '../../src/options_resolvers/processOpts';

describe('options_resolvers/processOpts', () => {
    it('should throw if processOpts is not an object or valid module path exporting object', () => {
        expect(
            () => processOpts('test/fixtures/generateScopedName.function.module.js')
        ).to.throw();

        expect(
            () => processOpts(null)
        ).to.throw();
    });

    it('should return object', () => {
        expect(processOpts({})).to.be.deep.equal({});
        expect(processOpts('test/fixtures/processCss.module.js')).to.be.deep.equal({});
    });
});
