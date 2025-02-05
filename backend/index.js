import dotenv from 'dotenv'
import mysql from 'mysql';
import fs from 'fs';
import https from 'https';

dotenv.config()

const con = mysql.createConnection({
    host: process.env.mysql_host,
    user: process.env.mysql_user,
    password: process.env.mysql_pass,
    database: process.env.mysql_db
});

GetPokemons();

setInterval(() => {
    GetPokemons();
}, 24 * 60 * 1000 * 60);

function GetPokemons(downloadSprites = true) {
    con.connect(function (err) {
        if (err) throw err;
    });

    fetch("https://pokeapi.co/api/v2/pokemon?limit=10000&offset=0")
        .then(res => res.json())
        .then((list) => {
            for (let i in list.results) {
                let pokemon = {};
                fetch(list.results[i].url)
                    .then(res => res.json())
                    .then((p) => {
                        if (p.is_default == true) {
                            pokemon.pokedex = p.id;
                            pokemon.name = p.name;
                            pokemon.name = pokemon.name.replace(/\-*/, '')
                            if (downloadSprites) {
                                if (!fs.existsSync("./sprites")) {
                                    fs.mkdirSync("./sprites");
                                }
                                let path = `./sprites/${pokemon.name}.png`;
                                if (!fs.existsSync(path)) {
                                    const file = fs.createWriteStream(path);
                                    https.get(p.sprites.front_default, (response) => {
                                        if (response.statusCode === 200) {
                                            response.pipe(file);
                                            file.on('finish', () => {
                                                file.close();
                                            });
                                        } else {
                                            console.log('Failed to download image. Status:', response.statusCode);
                                        }
                                    }).on('error', (err) => {
                                        fs.unlink(path, () => { });
                                        console.error('Error:', err.message);
                                    });
                                }
                                pokemon.sprite = path.replace(".", "");
                            }
                            else {
                                pokemon.sprite = p.sprites.front_default;
                            }
                            pokemon.types = [];
                            p.types.forEach(type => {
                                pokemon.types.push(type.type.name);
                            });
                            fetch(p.species.url)
                                .then(res => res.json())
                                .then((s) => {
                                    pokemon.generation = s.generation.name.replace("generation-", "").toUpperCase();
                                    pokemon.color = s.color.name;
                                    if (s.habitat != null) {
                                        pokemon.habitat = s.habitat.name;
                                    }
                                    if (s.shape != null) {
                                        pokemon.shape = s.shape.name;
                                    }
                                    var sql = `INSERT INTO pokemons (pokedex, name, generation, sprite, types, color, habitat, shape) VALUES ("${pokemon.pokedex}","${pokemon.name}","${pokemon.generation}","${pokemon.sprite}",'${JSON.stringify(pokemon.types)}',"${pokemon.color}","${pokemon.habitat}","${pokemon.shape}") ON DUPLICATE KEY UPDATE pokedex = "${pokemon.pokedex}", name = "${pokemon.name}"`;
                                    con.query(sql, function (err, result) {
                                        if (err) throw err;

                                        const dateObject = new Date();
                                        const month = dateObject.getMonth();
                                        const date = dateObject.getDate();
                                        const hours = dateObject.getHours();
                                        const minutes = dateObject.getMinutes();
                                        const seconds = dateObject.getSeconds();

                                        console.log(`[${month}/${date} ${hours}:${minutes}:${seconds}] Added ${pokemon.name}`);
                                    });
                                });
                        }
                    });
            }
        });
}