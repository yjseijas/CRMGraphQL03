const mongoose = require('mongoose');

require('dotenv').config({path: 'variables.env'});

const conectarDB = async () => {
    try {
        await mongoose.connect(process.env.DB_MONGO, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            useFindAndModify: false,
            useCreateIndex: true
        });

        console.log('Mongoose DB Conectada!')
    } catch (error) {
        console.log('Hubo un error al conectar a Mongo DB', error);
        process.exit(1); //detiene la app
    }
}

module.exports = conectarDB;