const SECCIONES = [
  {
    id: 'I', titulo: 'Animales vivos y productos del reino animal',
    capitulos: [
      { codigo: '01', titulo: 'Animales vivos', notas: 'Comprende todos los animales vivos, excepto los peces y crustáceos del Capítulo 03.' },
      { codigo: '02', titulo: 'Carne y despojos comestibles', notas: 'Incluye carnes frescas, refrigeradas, congeladas y conservadas.' },
      { codigo: '03', titulo: 'Pescados y crustáceos, moluscos y demás invertebrados acuáticos', notas: '' },
      { codigo: '04', titulo: 'Leche y productos lácteos; huevos de ave; miel natural', notas: '' },
      { codigo: '05', titulo: 'Los demás productos de origen animal no expresados ni comprendidos en otra parte', notas: '' },
    ]
  },
  {
    id: 'II', titulo: 'Productos del reino vegetal',
    capitulos: [
      { codigo: '06', titulo: 'Plantas vivas y productos de la floricultura', notas: '' },
      { codigo: '07', titulo: 'Hortalizas, plantas, raíces y tubérculos alimenticios', notas: '' },
      { codigo: '08', titulo: 'Frutas y frutos comestibles; cortezas de agrios o melones', notas: '' },
      { codigo: '09', titulo: 'Café, té, yerba mate y especias', notas: '' },
      { codigo: '10', titulo: 'Cereales', notas: '' },
      { codigo: '11', titulo: 'Productos de la molinería; malta; almidón y fécula; gluten', notas: '' },
      { codigo: '12', titulo: 'Semillas y frutos oleaginosos; semillas y frutos diversos', notas: '' },
      { codigo: '13', titulo: 'Gomas, resinas y demás jugos y extractos vegetales', notas: '' },
      { codigo: '14', titulo: 'Materias trenzables y demás productos de origen vegetal', notas: '' },
    ]
  },
  {
    id: 'III', titulo: 'Grasas y aceites animales o vegetales',
    capitulos: [
      { codigo: '15', titulo: 'Grasas y aceites animales o vegetales; productos de su desdoblamiento', notas: '' },
    ]
  },
  {
    id: 'IV', titulo: 'Productos de las industrias alimentarias; bebidas; tabaco',
    capitulos: [
      { codigo: '16', titulo: 'Preparaciones de carne, pescado o crustáceos', notas: '' },
      { codigo: '17', titulo: 'Azúcares y artículos de confitería', notas: '' },
      { codigo: '18', titulo: 'Cacao y sus preparaciones', notas: '' },
      { codigo: '19', titulo: 'Preparaciones a base de cereales, harina, almidón o leche', notas: '' },
      { codigo: '20', titulo: 'Preparaciones de hortalizas, frutas u otros frutos', notas: '' },
      { codigo: '21', titulo: 'Preparaciones alimenticias diversas', notas: '' },
      { codigo: '22', titulo: 'Bebidas, líquidos alcohólicos y vinagre', notas: '' },
      { codigo: '23', titulo: 'Residuos y desperdicios de las industrias alimentarias', notas: '' },
      { codigo: '24', titulo: 'Tabaco y sucedáneos del tabaco elaborados', notas: '' },
    ]
  },
  {
    id: 'V', titulo: 'Productos minerales',
    capitulos: [
      { codigo: '25', titulo: 'Sal; azufre; tierras y piedras; yesos, cales y cementos', notas: '' },
      { codigo: '26', titulo: 'Minerales metalíferos, escorias y cenizas', notas: '' },
      { codigo: '27', titulo: 'Combustibles minerales, aceites minerales y productos de su destilación', notas: 'Incluye petróleo crudo, gas natural, carbón y sus derivados.' },
    ]
  },
  {
    id: 'VI', titulo: 'Productos de las industrias químicas o de las industrias conexas',
    capitulos: [
      { codigo: '28', titulo: 'Productos químicos inorgánicos', notas: 'Comprende elementos químicos, compuestos inorgánicos, ácidos, sales.' },
      { codigo: '29', titulo: 'Productos químicos orgánicos', notas: '' },
      { codigo: '30', titulo: 'Productos farmacéuticos', notas: 'Incluye medicamentos, vacunas, y productos para uso médico.' },
      { codigo: '31', titulo: 'Abonos', notas: '' },
      { codigo: '32', titulo: 'Extractos curtientes o tintóreos; taninos y sus derivados; pigmentos', notas: '' },
      { codigo: '33', titulo: 'Aceites esenciales y resinoides; preparaciones de perfumería', notas: '' },
      { codigo: '34', titulo: 'Jabón, agentes de superficie orgánicos, preparaciones para lavar', notas: '' },
      { codigo: '35', titulo: 'Materias albuminoideas; productos a base de almidón modificado; colas', notas: '' },
      { codigo: '36', titulo: 'Pólvora y explosivos; artículos de pirotecnia; fósforos', notas: '' },
      { codigo: '37', titulo: 'Productos fotográficos o cinematográficos', notas: '' },
      { codigo: '38', titulo: 'Productos diversos de las industrias químicas', notas: '' },
    ]
  },
  {
    id: 'VII', titulo: 'Plástico y sus manufacturas; caucho y sus manufacturas',
    capitulos: [
      { codigo: '39', titulo: 'Plástico y sus manufacturas', notas: 'Capítulo principal para productos plásticos y poliméricos.' },
      { codigo: '40', titulo: 'Caucho y sus manufacturas', notas: '' },
    ]
  },
  {
    id: 'VIII', titulo: 'Pieles, cueros, peletería y manufacturas',
    capitulos: [
      { codigo: '41', titulo: 'Pieles (excepto la peletería) y cueros', notas: '' },
      { codigo: '42', titulo: 'Manufacturas de cuero; artículos de talabartería; bolsos', notas: '' },
      { codigo: '43', titulo: 'Peletería y confecciones de peletería', notas: '' },
    ]
  },
  {
    id: 'IX', titulo: 'Madera, carbón vegetal y manufacturas de madera',
    capitulos: [
      { codigo: '44', titulo: 'Madera, carbón vegetal y manufacturas de madera', notas: '' },
      { codigo: '45', titulo: 'Corcho y sus manufacturas', notas: '' },
      { codigo: '46', titulo: 'Manufacturas de espartería o cestería', notas: '' },
    ]
  },
  {
    id: 'X', titulo: 'Pastas de madera; papel y cartón',
    capitulos: [
      { codigo: '47', titulo: 'Pastas de madera o de otras materias fibrosas celulósicas', notas: '' },
      { codigo: '48', titulo: 'Papel y cartón; manufacturas de pasta de celulosa', notas: '' },
      { codigo: '49', titulo: 'Productos editoriales, de la prensa y de las demás industrias gráficas', notas: '' },
    ]
  },
  {
    id: 'XI', titulo: 'Materias textiles y sus manufacturas',
    capitulos: [
      { codigo: '50', titulo: 'Seda', notas: '' },
      { codigo: '51', titulo: 'Lana y pelo fino u ordinario; hilados y tejidos de crin', notas: '' },
      { codigo: '52', titulo: 'Algodón', notas: '' },
      { codigo: '53', titulo: 'Las demás fibras textiles vegetales', notas: '' },
      { codigo: '54', titulo: 'Filamentos sintéticos o artificiales', notas: '' },
      { codigo: '55', titulo: 'Fibras sintéticas o artificiales discontinuas', notas: '' },
      { codigo: '56', titulo: 'Guata, fieltro y telas sin tejer; hilados especiales', notas: '' },
      { codigo: '57', titulo: 'Alfombras y demás revestimientos para el suelo de materias textiles', notas: '' },
      { codigo: '58', titulo: 'Tejidos especiales; superficies textiles con mechón insertado', notas: '' },
      { codigo: '59', titulo: 'Telas impregnadas, recubiertas, revestidas o estratificadas', notas: '' },
      { codigo: '60', titulo: 'Tejidos de punto', notas: '' },
      { codigo: '61', titulo: 'Prendas de vestir de punto', notas: '' },
      { codigo: '62', titulo: 'Prendas de vestir de punto excepto los de punto', notas: '' },
      { codigo: '63', titulo: 'Los demás artículos textiles confeccionados', notas: '' },
    ]
  },
  {
    id: 'XII', titulo: 'Calzado, sombreros, paraguas, bastones, látigos',
    capitulos: [
      { codigo: '64', titulo: 'Calzado, polainas y artículos análogos', notas: 'Partidas arancelarias para todo tipo de calzado: deportivo, formal, botas, zapatillas.' },
      { codigo: '65', titulo: 'Sombreros, tocados y sus partes', notas: '' },
      { codigo: '66', titulo: 'Paraguas, sombrillas, bastones, látigos', notas: '' },
      { codigo: '67', titulo: 'Plumas y plumón preparados; flores artificiales', notas: '' },
    ]
  },
  {
    id: 'XIII', titulo: 'Manufacturas de piedra, yeso, cemento, amianto, mica',
    capitulos: [
      { codigo: '68', titulo: 'Manufacturas de piedra, yeso fraguable, cemento, amianto, mica', notas: '' },
      { codigo: '69', titulo: 'Productos cerámicos', notas: '' },
      { codigo: '70', titulo: 'Vidrio y sus manufacturas', notas: '' },
    ]
  },
  {
    id: 'XIV', titulo: 'Perlas finas, piedras preciosas, metales preciosos, bisutería',
    capitulos: [
      { codigo: '71', titulo: 'Perlas finas, piedras preciosas, metales preciosos, bisutería', notas: 'Comprende diamantes, oro, plata, platino y joyería.' },
    ]
  },
  {
    id: 'XV', titulo: 'Metales comunes y manufacturas de estos metales',
    capitulos: [
      { codigo: '72', titulo: 'Fundición, hierro y acero', notas: 'Incluye productos laminados planos, barras, alambrón de hierro/acero.' },
      { codigo: '73', titulo: 'Manufacturas de fundición, hierro o acero', notas: 'Incluye estructuras, tuberías, raíles, y accesorios de acero.' },
      { codigo: '74', titulo: 'Cobre y sus manufacturas', notas: '' },
      { codigo: '75', titulo: 'Níquel y sus manufacturas', notas: '' },
      { codigo: '76', titulo: 'Aluminio y sus manufacturas', notas: '' },
      { codigo: '78', titulo: 'Plomo y sus manufacturas', notas: '' },
      { codigo: '79', titulo: 'Zinc y sus manufacturas', notas: '' },
      { codigo: '80', titulo: 'Estaño y sus manufacturas', notas: '' },
      { codigo: '81', titulo: 'Los demás metales comunes', notas: '' },
      { codigo: '82', titulo: 'Herramientas, cuchillería y cubiertos de metal común', notas: '' },
      { codigo: '83', titulo: 'Manufacturas diversas de metal común', notas: '' },
    ]
  },
  {
    id: 'XVI', titulo: 'Máquinas, aparatos y material eléctrico',
    capitulos: [
      { codigo: '84', titulo: 'Reactores nucleares, calderas, máquinas, aparatos mecánicos', notas: 'Capítulo más extenso. Incluye motores, bombas, compresores, maquinaria industrial.' },
      { codigo: '85', titulo: 'Máquinas, aparatos y material eléctrico; aparatos de grabación o reproducción', notas: 'Incluye computadoras, teléfonos, circuitos, paneles solares.' },
    ]
  },
  {
    id: 'XVII', titulo: 'Material de transporte',
    capitulos: [
      { codigo: '86', titulo: 'Vehículos y material para vías férreas', notas: '' },
      { codigo: '87', titulo: 'Vehículos automóviles, tractores, ciclos y demás vehículos terrestres', notas: 'Incluye automóviles, camiones, motocicletas, bicicletas.' },
      { codigo: '88', titulo: 'Aeronaves, vehículos espaciales y sus partes', notas: '' },
      { codigo: '89', titulo: 'Barcos y demás artefactos flotantes', notas: '' },
    ]
  },
  {
    id: 'XVIII', titulo: 'Instrumentos de óptica, fotografía, medicina, relojería',
    capitulos: [
      { codigo: '90', titulo: 'Instrumentos y aparatos de óptica, fotografía, medicina, quirúrgicos', notas: 'Incluye equipos médicos, lentes, instrumentos de precisión.' },
      { codigo: '91', titulo: 'Relojería', notas: '' },
      { codigo: '92', titulo: 'Instrumentos musicales; partes y accesorios', notas: '' },
    ]
  },
  {
    id: 'XIX', titulo: 'Armas, municiones y sus partes',
    capitulos: [
      { codigo: '93', titulo: 'Armas, municiones y sus partes y accesorios', notas: '' },
    ]
  },
  {
    id: 'XX', titulo: 'Manufacturas diversas',
    capitulos: [
      { codigo: '94', titulo: 'Muebles; mobiliario médico-quirúrgico; artículos de cama', notas: 'Incluye muebles, colchones, lámparas y construcciones prefabricadas.' },
      { codigo: '95', titulo: 'Juguetes, juegos y artículos para recreo o deporte', notas: 'Incluye muñecas, videojuegos, artículos deportivos.' },
      { codigo: '96', titulo: 'Manufacturas diversas', notas: '' },
    ]
  },
  {
    id: 'XXI', titulo: 'Objetos de arte o colección y antigüedades',
    capitulos: [
      { codigo: '97', titulo: 'Objetos de arte o colección y antigüedades', notas: '' },
    ]
  }
];

const PARTIDAS = {
  '84': [
    { codigo: '8471', titulo: 'Máquinas automáticas para tratamiento o procesamiento de datos y sus unidades' },
    { codigo: '8473', titulo: 'Partes y accesorios para máquinas de la partida 8471' },
    { codigo: '8414', titulo: 'Bombas de aire o de vacío, compresores de aire' },
    { codigo: '8418', titulo: 'Refrigeradores, congeladores y material frigorífico' },
    { codigo: '8421', titulo: 'Centrifugadoras, aparatos para filtrar o depurar líquidos o gases' },
    { codigo: '8424', titulo: 'Aparatos mecánicos para proyectar, dispersar o pulverizar' },
    { codigo: '8431', titulo: 'Partes para máquinas y aparatos de las partidas 8425 a 8430' },
    { codigo: '8443', titulo: 'Máquinas y aparatos para impresión' },
    { codigo: '8450', titulo: 'Máquinas para lavar ropa' },
    { codigo: '8458', titulo: 'Máquinas herramienta para tornear' },
    { codigo: '8462', titulo: 'Máquinas para forjar, estampar o cortar metales' },
    { codigo: '8479', titulo: 'Máquinas y aparatos mecánicos con función propia' },
    { codigo: '8481', titulo: 'Grifos, llaves, válvulas y demás dispositivos para tuberías' },
    { codigo: '8482', titulo: 'Rodamientos de bolas o de rodillos' },
    { codigo: '8483', titulo: 'Árboles de transmisión, cajas de cojinetes, engranajes' },
  ],
  '85': [
    { codigo: '8517', titulo: 'Teléfonos y demás aparatos de transmisión o recepción de voz o datos' },
    { codigo: '8523', titulo: 'Soportes para grabar sonido o fenómenos análogos' },
    { codigo: '8525', titulo: 'Aparatos emisores de radiodifusión o televisión' },
    { codigo: '8528', titulo: 'Monitores y proyectores de televisión' },
    { codigo: '8536', titulo: 'Aparatos para corte, seccionamiento, protección de circuitos eléctricos' },
    { codigo: '8537', titulo: 'Cuadros, paneles, consolas para control eléctrico' },
    { codigo: '8541', titulo: 'Diodos, transistores y dispositivos semiconductores' },
    { codigo: '8542', titulo: 'Circuitos integrados electrónicos' },
    { codigo: '8543', titulo: 'Máquinas y aparatos eléctricos con función propia' },
    { codigo: '8544', titulo: 'Cables, conductores eléctricos aislados' },
  ],
  '87': [
    { codigo: '8701', titulo: 'Tractores' },
    { codigo: '8702', titulo: 'Vehículos automóviles para transporte de 10 o más personas' },
    { codigo: '8703', titulo: 'Automóviles para transporte de personas (incl. camionetas)' },
    { codigo: '8704', titulo: 'Vehículos para transporte de mercancías' },
    { codigo: '8708', titulo: 'Partes y accesorios para vehículos automóviles' },
    { codigo: '8711', titulo: 'Motocicletas y velocípedos con motor' },
    { codigo: '8712', titulo: 'Bicicletas y demás velocípedos sin motor' },
    { codigo: '8716', titulo: 'Remolques y semirremolques' },
  ],
  '90': [
    { codigo: '9018', titulo: 'Instrumentos y aparatos para medicina, cirugía, odontología' },
    { codigo: '9019', titulo: 'Aparatos de mecanoterapia, ozonoterapia, respiración artificial' },
    { codigo: '9021', titulo: 'Artículos y aparatos de ortopedia, incl. muletas' },
    { codigo: '9022', titulo: 'Aparatos de rayos X y radiaciones' },
    { codigo: '9027', titulo: 'Instrumentos para análisis físicos o químicos' },
    { codigo: '9030', titulo: 'Osciloscopios, analizadores de espectro y otros instrumentos' },
    { codigo: '9032', titulo: 'Instrumentos y aparatos para regulación o control automáticos' },
  ],
  '39': [
    { codigo: '3901', titulo: 'Polímeros de etileno en formas primarias' },
    { codigo: '3902', titulo: 'Polímeros de propileno en formas primarias' },
    { codigo: '3903', titulo: 'Polímeros de estireno en formas primarias' },
    { codigo: '3904', titulo: 'Polímeros de cloruro de vinilo en formas primarias' },
    { codigo: '3907', titulo: 'Poliacetales, policarbonatos, resinas alquídicas' },
    { codigo: '3917', titulo: 'Tubos y accesorios de tubería de plástico' },
    { codigo: '3919', titulo: 'Placas, láminas, hojas de plástico autoadhesivas' },
    { codigo: '3923', titulo: 'Artículos de transporte o envasado de plástico' },
    { codigo: '3924', titulo: 'Vajilla y artículos de uso doméstico de plástico' },
    { codigo: '3926', titulo: 'Las demás manufacturas de plástico' },
  ],
  '40': [
    { codigo: '4001', titulo: 'Caucho natural en formas primarias' },
    { codigo: '4011', titulo: 'Neumáticos nuevos de caucho' },
    { codigo: '4016', titulo: 'Las demás manufacturas de caucho vulcanizado' },
  ],
  '61': [
    { codigo: '6109', titulo: 'Camisetas de punto' },
    { codigo: '6110', titulo: 'Suéteres, cardiganes, chalecos de punto' },
    { codigo: '6204', titulo: 'Trajes sastre, conjuntos, chaquetas, vestidos de punto' },
  ],
  '62': [
    { codigo: '6204', titulo: 'Trajes sastre, conjuntos, chaquetas, vestidos (excepto punto)' },
    { codigo: '6205', titulo: 'Camisas para hombres o niños (excepto punto)' },
    { codigo: '6206', titulo: 'Camisas para mujeres o niñas (excepto punto)' },
  ],
  '64': [
    { codigo: '6402', titulo: 'Calzado con suela y parte superior de caucho o plástico' },
    { codigo: '6403', titulo: 'Calzado con suela de caucho y parte superior de cuero natural' },
    { codigo: '6404', titulo: 'Calzado con suela de caucho y parte superior de materia textil' },
    { codigo: '6405', titulo: 'Los demás calzados' },
    { codigo: '6406', titulo: 'Partes de calzado' },
  ],
  '73': [
    { codigo: '7301', titulo: 'Tablestacas de hierro o acero' },
    { codigo: '7304', titulo: 'Tubos y perfiles huecos de hierro o acero' },
    { codigo: '7306', titulo: 'Tubos y perfiles huecos de hierro o acero (soldados)' },
    { codigo: '7307', titulo: 'Accesorios de tubería de fundición, hierro o acero' },
    { codigo: '7308', titulo: 'Construcciones y sus partes de fundición, hierro o acero' },
    { codigo: '7318', titulo: 'Tornillos, pernos, tuercas, remaches, arandelas de hierro o acero' },
  ],
  '72': [
    { codigo: '7208', titulo: 'Productos laminados planos de hierro o acero sin alear' },
    { codigo: '7209', titulo: 'Productos laminados planos de hierro o acero sin alear (enrollados)' },
    { codigo: '7210', titulo: 'Productos laminados planos de hierro o acero (chapados)' },
    { codigo: '7213', titulo: 'Alambrón de hierro o acero sin alear' },
    { codigo: '7214', titulo: 'Barras de hierro o acero sin alear' },
  ],
  '94': [
    { codigo: '9401', titulo: 'Asientos (excepto los de la partida 9402)' },
    { codigo: '9403', titulo: 'Los demás muebles y sus partes' },
    { codigo: '9404', titulo: 'Sommieres, artículos de cama y colchones' },
    { codigo: '9405', titulo: 'Aparatos de alumbrado y sus partes' },
    { codigo: '9406', titulo: 'Construcciones prefabricadas' },
  ],
  '95': [
    { codigo: '9503', titulo: 'Triciclos, patinetes, muñecas, juguetes y modelos' },
    { codigo: '9504', titulo: 'Artículos para juegos de mesa o salón' },
    { codigo: '9505', titulo: 'Artículos para fiestas, carnaval y otros festejos' },
    { codigo: '9506', titulo: 'Artículos y material para cultura física, gimnasia, deportes' },
  ],
  '28': [
    { codigo: '2806', titulo: 'Ácido clorhídrico; ácido clorosulfúrico' },
    { codigo: '2815', titulo: 'Hidróxido y peróxido de sodio' },
    { codigo: '2828', titulo: 'Hipocloritos; cloritos; hipobromitos' },
  ],
  '30': [
    { codigo: '3001', titulo: 'Glándulas y demás órganos para usos terapéuticos' },
    { codigo: '3002', titulo: 'Sangre humana, antisueros, vacunas' },
    { codigo: '3004', titulo: 'Medicamentos para uso terapéutico o profiláctico' },
    { codigo: '3006', titulo: 'Preparaciones farmacéuticas especificadas en la Nota 4' },
  ],
};

export function buscarEnArbol(consulta) {
  const q = consulta.toLowerCase().trim();
  if (!q) return [];

  const resultados = [];

  for (const seccion of SECCIONES) {
    for (const cap of seccion.capitulos) {
      if (cap.codigo.includes(q) || cap.titulo.toLowerCase().includes(q)) {
        resultados.push({ seccion: seccion.id, tipo: 'capitulo', ...cap, partidas: PARTIDAS[cap.codigo] || [] });
      }
      const partidas = PARTIDAS[cap.codigo] || [];
      for (const p of partidas) {
        if (p.codigo.includes(q) || p.titulo.toLowerCase().includes(q)) {
          resultados.push({ seccion: seccion.id, tipo: 'partida', capitulo: cap, ...p });
        }
      }
    }
  }
  return resultados;
}

export function obtenerArbolCompleto() {
  return SECCIONES.map(s => ({
    ...s,
    capitulos: s.capitulos.map(c => ({
      ...c,
      partidas: PARTIDAS[c.codigo] || []
    }))
  }));
}

export function obtenerCapitulo(codigo) {
  for (const s of SECCIONES) {
    const cap = s.capitulos.find(c => c.codigo === codigo);
    if (cap) return { seccion: s.id, ...cap, partidas: PARTIDAS[codigo] || [] };
  }
  return null;
}

export { SECCIONES, PARTIDAS };
