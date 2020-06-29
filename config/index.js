module.exports = {
  database: {
    db_url: process.env.DB_URL,
  },
  app: {
    port: process.env.PORT || 3000,
    jwtSecret: process.env.TOKEN_SECRET,
  },
};
