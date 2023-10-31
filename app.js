const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const ejsMate = require('ejs-mate');
const session = require('express-session');
const flash = require('connect-flash')
const { campgroundSchema, reviewSchema } = require('./schemas.js');
const catchAsync = require('./helpers/catchAsync');
const ExpressError = require('./helpers/ExpressError');
const Campground = require('./models/campground');
const Review = require('./models/review');
const methodOverride = require('method-override');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/user')
const userRoutes = require('./routes/users');
const campgroundRoutes = require('./routes/campgrounds');
const { isLoggedIn } = require('./middleware')
const dbUrl = process.env.DB_URL

// mongodb://localhost:27017/yelp-camp'
// mongoose.connect('mongodb+srv://anubhavregmi2:Onepiece10@cluster0.gt1cs5h.mongodb.net/'), {
    
//     useNewUrlParser: true,
//     useCreateIndex: true,
//     useUnifiedTopology: true,
//     useFindAndModify: false

// };
mongoose.connect('mongodb+srv://anubhavregmi2:Onepiece10@cluster0.gt1cs5h.mongodb.net/', {
  serverSelectionTimeoutMS: 30000, // Adjust the timeout as needed
  socketTimeoutMS: 45000, 
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database Connected");
})





const app = express();

app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({ extended: true }))
app.use(methodOverride('_method'))
app.use(express.static(path.join(__dirname, 'public')));

const sessionConfig = {
    secret: 'thisshouldbeabettersecret!',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}
app.use(session(sessionConfig))
app.use(flash())

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
})


const validateReview = (req, res, next) => {
    const { error } = reviewSchema.validate(req.body);
    if (error) {
        const msg = error.details.map(el => el.message).join(',')
        throw new ExpressError(msg, 400)
    }
    else {
        next();
    }
}

app.use('/', userRoutes)
app.use('/campgrounds', campgroundRoutes)

app.get('/', (req, res) => {
    res.render('Home')
});


app.post('/campgrounds/:id/reviews', isLoggedIn, validateReview, catchAsync(async (req, res) => {
    const campground = await Campground.findById(req.params.id);
    const review = new Review(req.body.review);
    review.author = req.user._id;
    campground.reviews.push(review);
    await review.save();
    await campground.save();
    req.flash('success', ' Created a new Review Just Now')
    res.redirect(`/campgrounds/${campground._id}`)
}))

app.delete('/campground/:id/reviews/:reviewId', catchAsync(async (req, res) => {
    const { id, reviewId } = req.params;
    const trimmedReviewId = reviewId.trim();
    await Campground.findByIdAndUpdate(id, { $pull: { reviews: trimmedReviewId } })
    await Review.findByIdAndDelete(trimmedReviewId)
    req.flash('success', 'Sucessfully deleted a Review Just Now')
    res.redirect(`/campgrounds/${id}`)
}))

app.all('*', (req, res, next) => {
    next(new ExpressError('Page Not Found', 404));
})

app.use((err, req, res, next) => {
    const { statusCode = 500 } = err;
    if (!err.message) err.message = 'oh Something is wrong'
    res.status(statusCode).render('error', { err });

})

app.listen(3000, () => {
    console.log('port 3000');
})