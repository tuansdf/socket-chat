module.exports = {
  name: "socket-chat",
  script: "dist/index.js",
  interpreter: "bun",
  instances: 1,
  exec_mode: "fork",
  env: {
    PORT: 59449,
  },
};
