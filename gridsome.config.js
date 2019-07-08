module.exports = {
  plugins: [
    {
      use: "@gridsome/source-wordpress",
      options: {
        baseUrl: "https://ADD_URL_HERE/", //process.env.WP_API_BASE_URL, // required
        typeName: "WordPress", // GraphQL schema name (Optional)
        perPage: 100, // How many posts to load from server per request (Optional)
        concurrent: 10, // How many requests to run simultaneously (Optional)
        routes: {
          post: "/:year/:month/:day/:slug", //adds route for "post" post type (Optional)
          post_tag: "/tag/:slug" // adds route for "post_tag" post type (Optional)
        }
      }
    },
    {
      use: "~/src/plugins/gridsome-source-remote-wp-images",
      options: {
        baseUrl: "https://ADD_URL_HERE/",
        restBase: "/wp-json/wp/v2/magnetic_portfolio",
        imageDirectory: "src/assets/images",
        sizeToDownload: "medium_large",
        typeName: "WordPressPortfolioImage",
        belongsToTypeName: "WordPressMagneticPortfolio"
      }
    }
  ]
};
