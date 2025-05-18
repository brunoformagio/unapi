// Simple mock for the yaml module
module.exports = {
  parse: (content) => {
    try {
      return JSON.parse(content);
    } catch {
      return {};
    }
  },
};
