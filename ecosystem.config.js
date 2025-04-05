module.exports = {
  apps: [
    {
      name: "app-prod",
      script: "./app.js",
      env_production: {
        NODE_ENV: "production"
      }
    },
    {
      name: "app-dev",
      script: "./app.js",
      env_development: {
        NODE_ENV: "development"
      }
    }
  ]
};
