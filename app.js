//. app.js

var express = require( 'express' ),
    bodyParser = require( 'body-parser' ),
    ejs = require( 'ejs' ),
    request = require( 'request' ),
    session = require( 'express-session' ),
    app = express();

require( 'dotenv' ).config();

app.use( bodyParser.urlencoded( { extended: true } ) );
app.use( bodyParser.json() );
app.use( express.Router() );

app.set( 'views', __dirname + '/views' );
app.set( 'view engine', 'ejs' );

//. env values
var settings_auth0_domain = 'AUTH0_DOMAIN' in process.env ? process.env.AUTH0_DOMAIN : ''; 
var settings_auth0_management_client_id = 'AUTH0_MANAGEMENT_CLIENT_ID' in process.env ? process.env.AUTH0_MANAGEMENT_CLIENT_ID : ''; 
var settings_auth0_management_client_secret = 'AUTH0_MANAGEMENT_CLIENT_SECRET' in process.env ? process.env.AUTH0_MANAGEMENT_CLIENT_SECRET : ''; 

//. Auth0 Management API
var ManagementClient = require( 'auth0' ).ManagementClient;
var auth0 = new ManagementClient({
  domain: settings_auth0_domain,
  clientId: settings_auth0_management_client_id,
  clientSecret: settings_auth0_management_client_secret,
  scope: 'create:users read:users update:users'
});

//. Auth0
var passport = require( 'passport' );
var Auth0Strategy = require( 'passport-auth0' );
var strategy = new Auth0Strategy({
  domain: settings_auth0_domain,
  clientID: settings_auth0_client_id,
  clientSecret: settings_auth0_client_secret,
  callbackURL: settings_auth0_callback_url
}, function( accessToken, refreshToken, extraParams, profile, done ){
  //console.log( accessToken, refreshToken, extraParams, profile );
  profile.idToken = extraParams.id_token;
  return done( null, profile );
});
passport.use( strategy );

passport.serializeUser( function( user, done ){
  done( null, user );
});
passport.deserializeUser( function( user, done ){
  done( null, user );
});

//. Session
var sess = {
  secret: 'UserPictureSecret',
  cookie: {
    path: '/',
    maxAge: (7 * 24 * 60 * 60 * 1000)
  },
  resave: false,
  saveUninitialized: true
};
app.use( session( sess ) );
app.use( passport.initialize() );
app.use( passport.session() );

app.use( function( req, res, next ){
  if( req && req.query && req.query.error ){
    console.log( req.query.error );
  }
  if( req && req.query && req.query.error_description ){
    console.log( req.query.error_description );
  }
  next();
});


//. login
app.get( '/auth0/login', passport.authenticate( 'auth0', {
  scope: 'openid profile email',
  successRedirect: '/',
  failureRedirect: '/auth0/login'
}, function( req, res ){
  res.redirect( '/' );
}));

//. logout
app.get( '/auth0/logout', function( req, res, next ){
  req.logout( function( err ){
    if( err ){ return next( err ); }
    res.redirect( '/' );
  });
});

app.get( '/auth0/callback', async function( req, res, next ){
  passport.authenticate( 'auth0', function( err, user ){
    if( err ) return next( err );
    if( !user ) return res.redirect( '/auth0/login' );

    req.logIn( user, function( err ){
      if( err ) return next( err );
      res.redirect( '/' );
    })
  })( req, res, next );
});


app.get( '/', async function( req, res ){
  var user = null;
  try{
    if( req.user ){ 
      var user = { id: req.user.id, name: req.user.nickname, email: req.user.displayName, image_url: req.user.picture };
    }
    res.render( 'index', { user: user } );
  }catch( e ){
    console.log( e );
    res.render( 'index', { user: user } );
  }finally{
  }
});

app.post( '/image', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  try{
    if( req.user ){ 
      var user_id = req.user.id; //name: req.user.nickname, email: req.user.displayName, image_url: req.user.picture };

      var nickname = req.body.nickname;
      var picture = req.body.picture;
      if( nickname || picture ){
        var params = { id: user_id };
        var metadata = {};
        if( nickname ){ metadata.nickname = nickname; }
        if( picture ){ metadata.picture = picture; }
        console.log( { metadata } );

        //auth0.users.updateUserMetadata( params, metadata, function( err, user ){
        auth0.users.update( params, metadata, function( err, user ){
          if( err ){
            console.log( { err } );
            res.status( 400 );
            res.write( JSON.stringify( { status: false, error: err } ) );
            res.end();
          }else{
            console.log( { user } );
            res.write( JSON.stringify( { status: true, user: user } ) );
            res.end();
          }
        });
      }else{
        res.status( 400 );
        res.write( JSON.stringify( { status: false, error: 'nickname or picture is needed.' } ) );
        res.end();
      }
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, error: 'not logged in.' } ) );
      res.end();
    }
  }catch( e ){
    console.log( e );
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: e } ) );
    res.end();
  }finally{
  }
});

app.use( express.static( __dirname + '/public' ) );


function timestamp2date( ts ){
  if( ts ){
    var dt = new Date( ts );
    var yyyy = dt.getFullYear();
    var mm = dt.getMonth() + 1;
    var dd = dt.getDate();
    var hh = dt.getHours();
    var nn = dt.getMinutes();
    var ss = dt.getSeconds();
    var datetime = yyyy + '-' + ( mm < 10 ? '0' : '' ) + mm + '-' + ( dd < 10 ? '0' : '' ) + dd 
      + '<br/>' + ( hh < 10 ? '0' : '' ) + hh + ':' + ( nn < 10 ? '0' : '' ) + nn + ':' + ( ss < 10 ? '0' : '' ) + ss;
    return datetime;
  }else{
    return "";
  }
}

function timestamp2datetime( ts ){
  if( ts ){
    var dt = new Date( ts );
    var yyyy = dt.getFullYear();
    var mm = dt.getMonth() + 1;
    var dd = dt.getDate();
    var hh = dt.getHours();
    var nn = dt.getMinutes();
    var ss = dt.getSeconds();
    var datetime = yyyy + '-' + ( mm < 10 ? '0' : '' ) + mm + '-' + ( dd < 10 ? '0' : '' ) + dd
      + ' ' + ( hh < 10 ? '0' : '' ) + hh + ':' + ( nn < 10 ? '0' : '' ) + nn + ':' + ( ss < 10 ? '0' : '' ) + ss;
    return datetime;
  }else{
    return "";
  }
}


var port = process.env.PORT || 8080;
app.listen( port );
console.log( "server starting on " + port + " ..." );
