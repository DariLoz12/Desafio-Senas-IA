// Banco de preguntas organizadas por niveles de dificultad
// Cada nivel cuenta con 5 preguntas con palabras formadas por el alfabeto A-Z (sin Ñ ni tildes)
const NIVELES_PREGUNTAS = {
    facil: {
        nombre: "Fácil",
        descripcion: "Palabras cortas de 3 letras",
        preguntas: [
            {
                categoria: "Astronomía",
                icono: "fa-sun",
                pregunta: "¿Cuál es la estrella central de nuestro sistema solar?",
                pista: "Astro luminoso de 3 letras",
                palabra: "SOL"
            },
            {
                categoria: "Química",
                icono: "fa-gem",
                pregunta: "¿Qué metal precioso de color amarillo tiene el símbolo químico 'Au'?",
                pista: "Metal de gran valor (3 letras)",
                palabra: "ORO"
            },
            {
                categoria: "Naturaleza",
                icono: "fa-water",
                pregunta: "¿Gran extensión de agua salada que cubre la mayor parte de la Tierra?",
                pista: "Agua salada (3 letras)",
                palabra: "MAR"
            },
            {
                categoria: "Anatomía",
                icono: "fa-eye",
                pregunta: "¿Órgano de la visión en los seres humanos y animales?",
                pista: "Permite ver (3 letras)",
                palabra: "OJO"
            },
            {
                categoria: "Alimentación",
                icono: "fa-bread-slice",
                pregunta: "¿Alimento básico elaborado a base de harina, agua y levadura?",
                pista: "Se hornea (3 letras)",
                palabra: "PAN"
            }
        ]
    },
    normal: {
        nombre: "Normal",
        descripcion: "Palabras de 4 letras",
        preguntas: [
            {
                categoria: "Espacio",
                icono: "fa-moon",
                pregunta: "¿Cuál es el satélite natural que orbita alrededor de la Tierra?",
                pista: "Se ve de noche (4 letras)",
                palabra: "LUNA"
            },
            {
                categoria: "Naturaleza",
                icono: "fa-paw",
                pregunta: "¿Qué felino es conocido popularmente como el rey de la selva?",
                pista: "Gran felino melenudo (4 letras)",
                palabra: "LEON"
            },
            {
                categoria: "Mascotas",
                icono: "fa-cat",
                pregunta: "¿Animal doméstico felino conocido por ronronear y maullar?",
                pista: "Mascota común (4 letras)",
                palabra: "GATO"
            },
            {
                categoria: "Colores",
                icono: "fa-palette",
                pregunta: "¿Qué color tiene el cielo en un día despejado sin nubes?",
                pista: "Color primario (4 letras)",
                palabra: "AZUL"
            },
            {
                categoria: "Geografía",
                icono: "fa-landmark",
                pregunta: "¿Cuál es la capital de Italia, célebre por el Coliseo?",
                pista: "La ciudad eterna (4 letras)",
                palabra: "ROMA"
            }
        ]
    },
    dificil: {
        nombre: "Difícil",
        descripcion: "Palabras de 5 a 6 letras",
        preguntas: [
            {
                categoria: "Naturaleza",
                icono: "fa-tree",
                pregunta: "¿Planta leñosa perenne con tronco elevado y copa de ramas?",
                pista: "Produce sombra y oxígeno (5 letras)",
                palabra: "ARBOL"
            },
            {
                categoria: "Astronomía",
                icono: "fa-earth-americas",
                pregunta: "¿Cómo se llama el tercer planeta desde el Sol donde vivimos?",
                pista: "Nuestro planeta (6 letras)",
                palabra: "TIERRA"
            },
            {
                categoria: "Geografía",
                icono: "fa-mountain",
                pregunta: "¿Eminencia natural del terreno de gran altura y pendiente?",
                pista: "Elevación geográfica (6 letras)",
                palabra: "MONTE"
            },
            {
                categoria: "Cultura",
                icono: "fa-book",
                pregunta: "¿Obra impresa o digital formada por un conjunto de hojas encuadernadas?",
                pista: "Sirve para leer y estudiar (5 letras)",
                palabra: "LIBRO"
            },
            {
                categoria: "Música",
                icono: "fa-music",
                pregunta: "¿Instrumento musical de cuerda frotada con arco, el más pequeño y agudo de su familia?",
                pista: "Instrumento clásico (6 letras)",
                palabra: "VIOLIN"
            }
        ]
    }
};

// Mantener compatibilidad directa si se usa la referencia directa
let BANCO_PREGUNTAS = NIVELES_PREGUNTAS.facil.preguntas;
