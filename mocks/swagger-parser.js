// Simple mock for SwaggerParser
module.exports = {
  default: class MockSwaggerParser {
    async dereference(doc) {
      return doc; // Return the doc without actually dereferencing
    }
  },
};
