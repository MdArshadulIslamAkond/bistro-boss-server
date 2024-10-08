const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
const cors = require('cors');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;


//middleware

app.use(cors({
origin: ['http://localhost:5000', "https://bistro-boss-cd821.web.app", "https://bistro-boss-cd821.firebaseapp.com"]
}));
// app.use(express.static("public"));
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jp5aibk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// const calculateOrderAmount = (items) => {
//     // Calculate the order total on the server to prevent
//     // people from directly manipulating the amount on the client
//     let total = 0;
//     items.forEach((item) => {
//       total += item.amount;
//     });
//     return total;
//   };
 async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const menuCollection = client.db("bistroDB").collection("menu")
    const userCollection = client.db("bistroDB").collection("users")
    const reviewCollection = client.db("bistroDB").collection("reviews")
    const cartCollection = client.db("bistroDB").collection("carts")
    const paymentCollection = client.db("bistroDB").collection("payments")

    // jwt related api
    app.post('/jwt', async(req, res)=>{
        const  user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
        res.json({token});
    })
    // middlewares
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization.split(' ')[1];
    // console.log(req.headers.authorization, token);
    if (!req.headers.authorization) {
        return res.status(401).send({message: 'Access denied. No token provided.'})
    }else{
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded)=>{
            if(error){
                return res.status(403).send({message: 'forbidden access'})
            }
            req.decoded = decoded;
            console.log(req.decoded)
            next();
        })
    }
};

//use varify admin after varityToken
const verityAdmin = async(req, res, next) => {
    const email = req.decoded.email;
    const query = {email: email};
    const user = await userCollection.findOne(query);
    const isAdmin = user?.role === 'admin';
    if(!isAdmin){
        return res.status(403).send({message: 'forbidden access'})
    }
    next();
}


    // menu related api
    app.get('/menu', async (req, res) => {
        const menu = await menuCollection.find().toArray();
        res.json(menu);
    })
    app.get('/menu/:id', async (req, res) => {
        const id = req.params.id;
        // console.log(id);
        const query = {_id: new ObjectId(id)}; 
        const result = await menuCollection.findOne(query);
        res.json(result);
        })
        app.patch('/menu/:id', verifyToken, verityAdmin, async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const updateDoc = req.body;
            const query = {_id: new ObjectId(id)};
            // const options = { upsert: true };
            const result = await menuCollection.updateOne(query, { $set: updateDoc });
            res.send(result);
        });
    app.post('/menu', verifyToken, verityAdmin, async (req, res) => {
        const menu = req.body;
        const result = await menuCollection.insertOne(menu);
        res.send(result);
    })

    app.delete('/menu/:id', verifyToken, verityAdmin, async (req, res) => {
        const id = req.params.id;
        console.log(id);
        const query = {_id: new ObjectId(id)};
        const result = await menuCollection.deleteOne(query);
        res.send(result);
    });
    // Users related api
    app.get('/users', verifyToken, verityAdmin, async (req, res) => {
        // console.log(req.headers);
        const result = await userCollection.find().toArray( );
        res.json(result);
    })

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        if(email !== req.decoded.email) {
            return res.status(403).send({message: 'forbidden access'})
        }
        const query = {email: email};
        const user = await userCollection.findOne(query);
        let admin = false;
        if(user) {
            admin = user?.role === 'admin';
        }
        res.json({admin}); 
    })
    
    app.post('/users', async (req, res) => {
        const user = req.body;
        const query = {email: user.email};
        const existingUser = await userCollection.findOne(query);
        if(existingUser) {
            return res.send({messagr:'User already exists', insertedId: null});
        }
        const result = await userCollection.insertOne(user);
        res.send(result);
    });
    app.patch('/users/admin/:id', verifyToken, verityAdmin, async (req, res) => {
        const id = req.params.id;
        const filter = {_id: new ObjectId(id)};
        const updatedDoc = {
            $set: {
                role: 'admin'
            }
        }
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
    });
    app.delete('/users/:id', verifyToken, verityAdmin, async (req, res) => {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await userCollection.deleteOne(query);
        res.send(result);
    });   
    //Reviews related api
    app.get('/reviews', async (req, res) => {
        const menu = await reviewCollection.find().toArray();
        res.json(menu);
    })

    app.post('/reviews', async (req, res) => {
        const review = req.body;
        const result = await reviewCollection.insertOne(review);
        res.send(result);
    })    

    //Carts related api
    app.get('/carts', async (req, res) => {
        // const email = req.query.email;
        // const query = {email: email};
        // const cart = await cartCollection.find(query).toArray();
        const filter = req.query;
        // const search = req.query.search;
        console.log(filter);
        const pipeline = [
        
          {
              $addFields: {
                  priceNumeric: { $toDouble: "$price" }, // Convert string to double
                //   emailAsString: { $toString: "$email" }
              }
          },
          {
            $match: {
              priceNumeric: { $lt: 300},
              email: filter.email,
            //   emailAsString: {$regex: filter.email, $options: 'i'},
            // ...(categories && categories.length > 0 ? { category: { $in: categories } } : {}), // Match by categories if provided
            }
          },
          {
              $sort: {
                  priceNumeric: filter.sort === 'asc' ? 1: -1 // Sort by the numeric price
              }
          }];
          const cart = await cartCollection.aggregate(pipeline).toArray();
        res.json(cart);
    })
    app.post('/carts', async (req, res) => {
        const cartItem = req.body;
        const result = await cartCollection.insertOne(cartItem);
        res.json(result);
    })

    app.delete('/carts/:id', async (req, res) =>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await cartCollection.deleteOne(query);
        res.json(result);
    });

    // Payment intent
    app.post('/create-payment-intent', async (req, res) =>{
        const { price } = req.body;
        const amount = parseInt(price * 100); 
        try{
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card'],
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        } catch (error) {
            res.status(500).send({ error: error.message });
          }

    })
    app.get('/payments', verifyToken,  async (req, res) =>{
        console.log(req.query);
        const email = req.query.email;
        const asc = req.query.sort;
        // const query = { email: email };
        if(email !== req.decoded.email){
            return res.status(403).send({message: 'forbidden access'});
        }
        // const payments = await paymentCollection.find(query).toArray();
        const pipeline = [
            {
                $addFields: {
                    priceNumeric: { $toDouble: "$price" }, // Convert string to double
                }
            },
            {
                $match: {
                    priceNumeric: { $lt: 30000000000},
                    email: email,
                }
            },
            {
                $sort: {
                    priceNumeric: asc === 'asc'? 1 : -1
                }
            }
        ];
        const payments = await paymentCollection.aggregate(pipeline).toArray();
        res.json(payments);
    }) 
    app.post('/payments', async (req, res) =>{
        const payment = req.body;
        const paymentResult = await paymentCollection.insertOne(payment);

        // carefully delete eatch item from cart
        console.log('payment info', payment); 
        const query = { _id:{
                $in: payment.cartIds.map(id => new ObjectId(id))
            }
        }
        const deleteResult = await cartCollection.deleteMany(query);
        res.send({paymentResult, deleteResult});
    })

    // stats or analytics

    app.get('/admin-sats', verifyToken, verityAdmin, async (req, res)=>{
        const users = await userCollection.estimatedDocumentCount();
        const menuItems = await menuCollection.estimatedDocumentCount();
        const orders = await paymentCollection.estimatedDocumentCount();
        // total revenue
        const totalRevenue = await paymentCollection.aggregate([
            // { $match: { status: 'succeeded' } },
            { $group: { _id: null, totalRevenue: { $sum: '$price' } } },
        ]).toArray();
        const revenue = totalRevenue.length > 0 ? totalRevenue[0].totalRevenue : 0;

        res.send({
            users,
            menuItems,
            orders,
            revenue,
        })
    })
    // Using aggregate pipline

    app.get('/order-stats', verifyToken, verityAdmin, async (req, res)=>{
        const pipeline = [
           {
            $unwind: '$menuItemIds',
           },
           {
             // Convert menuItemIds to ObjectId if stored as string
            $addFields:{
                menuItemIds: {$toObjectId: '$menuItemIds'}
            }
           },
           {
            $lookup: {
                from: 'menu',
                localField: 'menuItemIds',
                foreignField: '_id',
                as: 'menuItems',
            }
           },
           {
            $unwind: '$menuItems',
           },
           {
            $group: {
                _id: '$menuItems.category',
                quantity: {$sum: 1},
                revenue: {$sum: '$menuItems.price'}
            }
           },
           {
            $project: {
                _id: 0,
                category: '$_id',
                quantity: '$quantity',
                revenue: '$revenue',
            }
           }
        ]

        const result = await paymentCollection.aggregate(pipeline).toArray();
        res.send(result);
    })

    app.get('/user-stats', verifyToken, async (req, res) =>{
        const email = req.query.email;
        const menuItems = await menuCollection.estimatedDocumentCount();
        const pipeline = [
            {
                $match: { email: email },
            },
            {
                $group: {
                    _id: null,
                    quantity: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 0,
                    quantity: '$quantity',
                },
            }
        ]
        const orders = await cartCollection.aggregate(pipeline).toArray();
        const review = await reviewCollection.aggregate(pipeline).toArray();
        const payment = await paymentCollection.aggregate(pipeline).toArray();
        res.send({
            orders,
            menuItems,
            review,
            payment,

        });
    })
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
res.send('Boss is sitting')
});

app.listen(port, (req, res) => {
    console.log(`Bistro boss Server is running on port ${port}`);
});