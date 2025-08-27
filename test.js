app.get("/trendingArticles", async (_req, res) => {
  try {
    const news = await trendingArticles.find({})
      .sort({ views: -1 }) // 📌 Sort by views descending
      .toArray();
    res.send(news);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch trending articles" });
  }
});