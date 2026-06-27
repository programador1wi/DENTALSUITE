export type EvolutionTemplateCategory = "General" | "Ortodoncia";

export interface EvolutionTemplate {
  id: string;
  name: string;
  category: EvolutionTemplateCategory;
  content: string;
}

export const EVOLUTION_TEMPLATES: EvolutionTemplate[] = [
  {
    id: "resinas",
    name: "RESINAS",
    category: "General",
    content: `Se colocó anestesia (Especificar cantidad de cartuchos y tipo de anestesia) con técnica (especificar técnica utilizada). Solo si colocamos anestesia.
se elimina tejido carioso en O.D XX sobre cara ( vestibular, palatino, lingual, oclusal, mesial o distal), O.D XX sobre cara ( vestibular, palatino, lingual, oclusal, mesial o distal)y se realiza sepsis de las zonas con Clorexhidina al 2%.
Se colocó base (indicar el tipo de base, solo si la caries se presenta en 2do, 3er o 4to grado).
Se gravan paredes y superficie con acido grabador dejando actuar por (#) segundos y después se retira con agua de jeringa triple.
Realizamos bondeo con bonding (marca)y fotocuramos por (#)segundos.
Se coloca resina (especificar tipo y tono) por técnica de estratificación fotocurando capa por capa (#) segundos.
Verificamos altura y oclusión con papel articular e hicimos pulido de superficie.
En caso de presentarse complicaciones, se deberá especificar, caso contrario colocar SIN COMPLICACIONES.
Mencionar las indicaciones y contraindicaciones post tratamientos.`
  },
  {
    id: "extraccion",
    name: "EXTRACCIÓN",
    category: "General",
    content: `Se colocó anestesia (Especificar cantidad de cartuchos y tipo de anestesia) con técnica (especificar técnica utilizada). Solo si colocamos anestesia.
se elimina tejido carioso en O.D XX sobre cara ( vestibular, palatino, lingual, oclusal, mesial o distal), O.D XX sobre cara ( vestibular, palatino, lingual, oclusal, mesial o distal)y se realiza sepsis de las zonas con Clorexhidina al 2%.
Se colocó base (indicar el tipo de base, solo si la caries se presenta en 2do, 3er o 4to grado).
Se gravan paredes y superficie con acido grabador dejando actuar por (#) segundos y después se retira con agua de jeringa triple.
Realizamos bondeo con bonding (marca)y fotocuramos por (#)segundos.
Se coloca resina (especificar tipo y tono) por técnica de estratificación fotocurando capa por capa (#) segundos.
Verificamos altura y oclusión con papel articular e hicimos pulido de superficie.
En caso de presentarse complicaciones, se deberá especificar, caso contrario colocar SIN COMPLICACIONES.
Mencionar las indicaciones y contraindicaciones post tratamientos.`
  },
  {
    id: "curacion",
    name: "CURACIÓN",
    category: "General",
    content: `Se colocó anestesia (Especificar cantidad de cartuchos y tipo de anestesia) con técnica (especificar técnica utilizada). Solo si colocamos anestesia.
se elimina tejido carioso en O.D XX sobre cara (vestibular, palatino, lingual, oclusal, mesial o distal), O.D XX sobre cara ( vestibular, palatino, lingual, oclusal, mesial o distal)y se realiza sepsis de las zonas con Clorexhidina al 2%.
Se colocó (curación Zoe ó curación ionómero, escribir detalladamente el proceso utilizado según tipo de curación)
En caso de presentarse complicaciones, se deberá especificar, caso contrario colocar SIN COMPLICACIONES.
Mencionar las indicaciones y contraindicaciones post tratamientos.`
  },
  {
    id: "limpieza-profunda",
    name: "LIMPIEZA DENTAL ULTRASÓNICA PROFUNDA",
    category: "General",
    content: `Se realiza limpieza dental ultrasónica profunda en arcada superior e inferior iniciando con destartaje supra e infragingival seguido de remoción de sarro por caras (se marcan las caras y superficies del órgano dental) de (se señala O.D o Sextante) con punta de cavitrón # (Colocar número), remoción de sarro interdental con lijas interproximales (la descripción anterior solo si se realiza, si no se elimina), se pide al Px enjuagarse con abundante agua para la eliminación de los restos del sarro en boca.
Se dan las siguientes indicaciones: (escribir indicaciones que se dieron después del tratamiento)
Este tratamiento puede realizarse hasta en 3 sesiones máximo dependiendo de la cantidad de sarro y el sangrado presente en el paciente.`
  },
  {
    id: "cepillado-profilactico",
    name: "CEPILLADO PROFILÁCTICO",
    category: "General",
    content: `Se realiza cepillado profiláctico con pasta profiláctica y cepillo giratorio, se coloca pasta por todas las caras (Indicar las caras y superficies de los O.D o Sextantes a tratar), posteriormente se pule con el cepillo giratorio y se pide al Px que se enjuague con abundante agua.
Se dan las siguientes indicaciones: (escribir indicaciones que se dieron después del tratamiento)`
  },
  {
    id: "limpieza-ultrasonica",
    name: "LIMPIEZA DENTAL ULTRASÓNICA",
    category: "General",
    content: `Se realiza limpieza dental ultrasónica en arcada superior e inferior iniciando con destartaje por cara (Indicar las caras y superficies del órgano dental) de (indicar O.D. o sextante) con punta de cavitrón # (colocar numero), remoción de sarro interdental con lijas interproximales (la descripción anterior solo si se realiza, si no se elimina), se pide al PX enjuagarse con abundante agua para la eliminación de los restos del sarro en boca.
Se dan las siguientes indicaciones: (escribir indicaciones que se dieron después del tratamiento)`
  },
  {
    id: "bondeo-brackeo",
    name: "BONDEO/BRACKEO",
    category: "Ortodoncia",
    content: `SE REALIZA COLOCACIÓN DE BRACKETS SUPERIOR O INFERIOR (COLOCAR NOMBRE DE TIPO DE BRACKET)
SE COLOCA EL RETRACTOR EN LA CAVIDAD BUCAL.
SE PROCEDE A LIMPIAR Y SECAR TODAS LAS CARAS VESTIBULARES DE (ESCRIBIR DESDE QUE OD A QUE OD)
COLOCACIÓN DE ÁCIDO GRABADOR EN TODAS LAS CARAS VESTIBULARES DEJANDO ACTUAR POR 20 SEGUNDOS, SE LAVA Y ENJUAGA EL ÁCIDO GRABADOR CON ABUNDANTE AGUA.
SECADO DE LAS CARAS VESTIBULARES CON JERINGA TRIPLE HASTA DEJAR OPACA LA SUPERFICIE.
SE COLOCA ADHESIVO EN LAS CARAS VESTIBULARES Y SE FOTOCURA POR DIENTE 15 SEGUNDOS.
SE COLOCA RESINA (COLOCAR MARCA DE RESINA) EN CADA UNA DE LAS MALLAS DE LOS BRACKETS CON COLOCACIÓN Y POSICIONAMIENTO UNO A UNO, FOTOCURANDO 20 SEGUNDOS, SE PROCEDE A VERIFICAR LA ADHESIÓN CON MOVIMIENTOS AL BRACKET.
SE COLOCA EL ARCO (COLOCAR MATERIAL DEL ARCO Y MEDIDA)SUPERIOR O INFERIOR PREVIAMENTE CORTADO.
SE VERIFICA OCLUSIÓN SI ES EL CASO SE COLOCA PISTA DE RESINA BLOCK OUT.
SE COLOCAN MÓDULOS DE (DE QUE OD A QUE OD) CON PINZA MATEW.
SE ELIMINAN EXCESOS DE ARCO CON LA PINZA DE COTE RECTO.
SE DAN INDICACIONES DE CUIDADO AL PACIENTE, TÉCNICA DE CEPILLADO, SE EXPLICAN LAS GARANTÍAS Y TRATAMIENTOS A REALIZAR POSTERIORMENTE A LA COLOCACIÓN.`
  },
  {
    id: "seguimiento-mensualidades",
    name: "SEGUIMIENTO / MENSUALIDADES",
    category: "Ortodoncia",
    content: `PACIENTE ACUDE A CITA DE SEGUIMIENTO PARA CONTROL DE ORTODONCIA.
SE RETIRAN MÓDULOS CON EXPLORADOR.
SE RETIRAN ARCOS CON PINZA MATEW.
SE ACTIVAN ARCOS NUEVOS PREVIAMENTE CORTADOS (COLOCAR MATERIAL DEL ARCO, MEDIDA Y SI ES SUPERIOR O INFERIOR)SE COLOCAN MÓDULOS (COLOR ROJO)CON PINZA MATEW.
OBSERVACIÓN:
SE COLOCA OPEN COIL PARA _____ ELÁSTICOS INTRA ORALES / ONZAS
SE REMITE AL PACIENTE A TODA DE RADIOGRAFÍAS DE CONTROL.`
  },
  {
    id: "garantia-bracket",
    name: "GARANTÍA REPOSICIÓN/CEMENTACIÓN BRACKET-TUBO",
    category: "Ortodoncia",
    content: `PACIENTE ACUDE A COLOCACIÓN POR GARANTÍA DEL BRACKET(S) O TUBO(S) NÚMERO (INDICAR EL OD), SE RETIRA LOS MÓDULOS CON EXPLORADOR, SE RETIRAN ARCOS CON PINZA MATEW, SE PROCEDE A ELIMINAR RESIDUOS DE RESINA CON FRESA DE ARCANZAS, SE REALIZA EL GRABADO ÁCIDO POR 20 SEGUNDOS, SE LAVA CON ABUNDANTE AGUA, SE SECA CON JERINGA TRIPLE, SE COLOCA EL ADHESIVO Y SE FOTOCURA POR 20 SEGUNDOS SE PRECEDE A COLOCAR EL BRACKET O TUBO CON RESINA (COLOCAR NOMBRE Y MARCA DE RESINA),SE POSICIONA Y FOTOCURA.SE COLOCA EL ARCO Y EL MÓDULOCON PINZA MATEW.`
  },
  {
    id: "reposicion-costo-bracket",
    name: "REPOSICIÓN/CEMENTACIÓN BRACKET-TUBO CON COSTO",
    category: "Ortodoncia",
    content: `PACIENTE ACUDE A REPOSICIÓN DEL BRACKET(S) O TUBO(S) NÚMERO (INDICAR EL OD),SE RETIRA LOS MÓDULOS CON EXPLORADOR, SE RETIRAN ARCOS CON PINZA MATEW, SE PROCEDE A ELIMINAR RESIDUOS DE RESINA CON FRESA DE ARCANZAS, SE REALIZA EL GRABADO ÁCIDO POR 20 SEGUNDOS, SE LAVA CON ABUNDANTE AGUA, SE SECA CON JERINGA TRIPLE, SE COLOCA EL ADHESIVO Y SE FOTOCURA POR 20 SEGUNDOS SE PRECEDE A COLOCAR EL BRACKET O TUBO CON RESINA (COLOCAR NOMBRE Y MARCA DE RESINA),SE POSICIONA Y FOTOCURA.SE COLOCA EL ARCO Y EL MÓDULOCON PINZA MATEW.`
  }
];
