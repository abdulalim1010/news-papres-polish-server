const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const Stripe = require("stripe");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster2.emeucb3.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri);

let trendingArticles, publishersCollection, articlesCollection, usersCollection;

async function run() {
  try {
    //await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db("newCollection");
    trendingArticles = db.collection("trArticles");
    publishersCollection = db.collection("publishers");
    articlesCollection = db.collection("articles");
    usersCollection = db.collection("users");

    // 🏠 Home
    app.get("/", (_req, res) => {
      res.send("📰 News API is Running...");
    });

    
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



    //trdetais
    app.get("/trendingArticles/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const article = await trendingArticles.findOne({ _id: new ObjectId(id) });
    
        if (!article) {
          return res.status(404).json({ message: "Trending article not found" });
        }
    
        res.send(article);
      } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
      }
    });
    
    
    
    

    // 🧑‍💼 Publishers
    app.post("/publishers", async (req, res) => {
      const result = await publishersCollection.insertOne(req.body);
      res.send(result);
    });

    //refresh problem
    

    app.get("/publishers", async (_req, res) => {
      const result = await publishersCollection.find().toArray();
      res.send(result);
    });

    // 📝 Articles
    app.post("/articles", async (req, res) => {
      const article = {
        ...req.body,
        status: "pending",
        isPremium: false,
        createdAt: new Date(),
      };
      const result = await articlesCollection.insertOne(article);
      res.send(result);
    });

  // GET /articles?email=user@example.com
app.get("/articles", async (req, res) => {
  const email = req.query.email;
  if (!email) {
    return res.status(400).send({ error: "Email is required" });
  }
  try {
    const articles = await articlesCollection.find({ authorEmail: email }).toArray();
    res.send(articles);
  } catch (error) {
    res.status(500).send({ error: "Server error" });
  }
});


    app.delete("/articles/:id", async (req, res) => {
      const id = req.params.id;
      const result = await articlesCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.put("/articles/:id", async (req, res) => {
      const id = req.params.id;
      const { title, content } = req.body;
      const result = await articlesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { title, content, updatedAt: new Date(), status: "pending" } }
      );
      res.send(result);
    });

    app.get("/article/:id", async (req, res) => {
      const id = req.params.id;
      const article = await articlesCollection.findOne({ _id: new ObjectId(id) });
      res.send(article);
    });

    // 🔍 All Approved Articles with Filter
    app.get("/all-articles", async (req, res) => {
      const { search = "", publisher = "", tag = "" } = req.query;
      const query = {
        status: "approved",
        ...(search && { title: { $regex: search, $options: "i" } }),
        ...(publisher && { publisher }),
        ...(tag && { tags: tag }),
      };
      const result = await articlesCollection.find(query).toArray();
      res.send(result);
    });

    // 👥 Users
    app.put("/users", async (req, res) => {
      const user = req.body;
    
      const existingUser = await usersCollection.findOne({ email: user.email });
    
      const result = await usersCollection.updateOne(
        { email: user.email },
        {
          $set: {
            name: user.name || existingUser?.name || "",
            email: user.email,
            role: existingUser?.role || "user", //  Don’t overwrite admin!
          },
        },
        { upsert: true }
      );
    
      res.send(result);
    });
    

    // 🔄 Get single user by email
    app.get("/users", async (req, res) => {
      const email = req.query.email;
    
      try {
        if (email) {
          // specific user fetch
          const user = await usersCollection.findOne({ email });
          return res.send(user);
        } else {
          // sob user fetch
          const users = await usersCollection.find().toArray();
          return res.send(users);
        }
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });
    app.get("/users", async (req, res) => {
      const email = req.query.email;
    
      if (!email) return res.status(400).send({ error: "Email is required" });
    
      try {
        const user = await usersCollection.findOne({ email });
    
        if (!user) return res.status(404).send({ error: "User not found" });
    
        // Check if premium expired
        if (user.isPremium && user.premiumExpireAt) {
          const now = new Date();
          if (now > user.premiumExpireAt) {
            // Expired — update user
            await usersCollection.updateOne(
              { email },
              { $set: { isPremium: false, premiumTaken: null, premiumExpireAt: null } }
            );
    
            // Reflect changes in user object too
            user.isPremium = false;
            user.premiumTaken = null;
            user.premiumExpireAt = null;
          }
        }
    
        res.send(user);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    

// sob article dekhate (admin dashboard er jonno)
app.get("/dashboard/articles", async (req, res) => {
  try {
    const articles = await articlesCollection.find().toArray();
    res.send(articles);
  } catch (err) {
    res.status(500).send({ error: "Internal Server Error" });
  }
});
app.patch("/articles/approve/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const result = await articlesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "approved" } }
    );
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Failed to approve article" });
  }
});




    


    // 📊 User Stats
    app.get("/user-stats", async (_req, res) => {
      const allUsers = await usersCollection.find().toArray();
      const total = allUsers.length;
      const premium = allUsers.filter((u) => u.isPremium).length;
      const normal = total - premium;
      res.send({ totalUsers: total, premiumUsers: premium, normalUsers: normal });
    });

    // 🪙 Make Premium
    app.patch("/make-premium/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.updateOne(
        { email },
        { $set: { isPremium: true, premiumTaken: new Date() } }
      );
      res.send(result);
    });

    //  Stripe: Payment Intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;

      if (!price || price <= 0) {
        return res.status(400).json({ error: "Invalid price" });
      }

      const amount = Math.round(price * 100);

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (err) {
        console.error("Stripe error:", err);
        res.status(500).json({ error: "Payment Intent failed" });
      }
    });

    //premium articles
    app.get('/premium-articles', async (req, res) => {
      try {
        const result = await articlesCollection.find({ isPremium: true, status: "approved" }).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    

    //update user role
    // Make admin
app.patch("/users/admin/:email", async (req, res) => {
  const email = req.params.email;
  const result = await usersCollection.updateOne(
    { email },
    { $set: { role: "admin" } }
  );
  res.send(result);
});

s:



    app.patch("/make-premium/:email", async (req, res) => {
      const email = req.params.email;
      const { duration } = req.body;

      // Duration handling.e
      const now = new Date();
      let expiry;
      if (duration === "1min") {
        expiry = new Date(now.getTime() + 1 * 60000);
      } else if (duration === "5days") {
        expiry = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
      } else if (duration === "10days") {
        expiry = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
      }

      const result = await usersCollection.updateOne(
        { email },
        {
          $set: {
            isPremium: true,
            premiumTaken: now,
            premiumExpireAt: expiry
          }
        }
      );

      res.send(result);
    });
     // Get all active subscribers
  app.get('/subscribers', async (_req, res) => {
    const now = new Date();
    try {
      const subscribers = await usersCollection.find({
        isPremium: true,
        premiumExpireAt: { $gt: now }
      }).toArray();
      res.send(subscribers);
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });


    // ✅ Start Server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error(" MongoDB connection failed:", err);
    process.exit(1);
  }
}

run().catch(console.dir);
