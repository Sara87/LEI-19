var express = require('express');
var router = express.Router();
var jsmzml = require('js_mzml');
var fs = require('fs')
const multer = require('multer')
var Regex = require("regex");
const exec = require('child_process').exec;
const createCsvWriter = require('csv-writer').createArrayCsvWriter;

function getContent(filename, callback){
    
  file = 'RAW/' + filename + '.mzML' ;

  let mzml = new jsmzml(file);
  
  let options = {
    'level': '1',
    'rtBegin': 0,
    'rtEnd': 9999999999
  };

  mzml.retrieve(options, () => {
    
    let matrix = []
    let sumIntensity = new Array(Object.keys(mzml.spectra).length).fill(0);
    let numScans = Array.apply(null, {length: Object.keys(mzml.spectra).length}).map(Number.call, Number)
    
    let header = Array.apply(null, {length: 1000}).map(Number.call, Number)
    
    
    //matrix[0] = Array.apply(null, {length: 1000}).map(Number.call, Number)
    for(let i = 0; i < Object.keys(mzml.spectra).length; i++){
      matrix[i] = new Array(1000).fill(0);
      let key = Object.keys(mzml.spectra)[i]
  
      for(let j = 0; j< mzml.spectra[key].mass.length; j++){
        let mass = Math.round(mzml.spectra[key].mass[j])
        let intensity = mzml.spectra[key].intensity[j]
        
        if(intensity){
          matrix[i][mass-1] = Number.parseFloat(intensity.toFixed(2))
        } 
      }
      sumIntensity[i] = parseFloat(matrix[i].reduce((acc, actual) => acc + actual).toFixed(2))
    }

    var response = "ERROR CREATING CSV"

    let csvWriter = createCsvWriter({
      header: header,
      path: './csv/' + filename + '.csv'
    })
    
    csvWriter.writeRecords(matrix)
      .then(() => {
        response = "OK"
        callback({status: response})
      })
      .catch(err => {
        callback({status: response})
      });
    
    /*
    var output = []

    var result = {
      scans: numScans,
      intensity: sumIntensity
    }
    output.push(result)
    */
  });
}

//Set storage engine
const storage = multer.diskStorage({
  destination: './RAW/',
  filename: (req, file, cb) =>{
    cb(null, file.originalname)
  }
})

const upload = multer({
  storage: storage
}).array('file', 100)

router.get('/', (req, res) =>{
  res.render('file')
})

router.post('/import', (req, res) => {
   upload(req, res, (errupl) =>{
    if(!errupl){
      let fileRaw = req.files[0].originalname.replace(/(\s)+/g, '\\ ');
      let fileMzml = fileRaw.split('.')[0] + '.mzML'
      
      if(fileRaw.split('.')[1] != "RAW"){ 
        exec('rm ' + __dirname + '/../RAW/' + file);
        res.send({status: "FILE TYPE ERROR"}) 
      }
      
      else { 
        let error = 0
        let testscript = exec('docker run --rm -e WINEDEBUG=-all -v '+ __dirname +'/../RAW:/data/ rawconverter wine msconvert ' + fileRaw);
        
        testscript.stderr.on('data', (data) => {
          error = 1
          exec('rm ' + __dirname + '/../RAW/' + fileRaw);
          exec('rm ' + __dirname + '/../RAW/' + fileMzml);
          res.send({status: "ERROR CONVERTING THE FILE"})
        });

        testscript.on('exit', () => {
          if(error == 0){
            getContent(fileRaw.split('.')[0], (output) => {
              exec('rm ' + __dirname + '/../RAW/' + fileMzml);
              res.jsonp(output)
            })
          }
        })
      }
    } else {
      console.log(errupl)
    }
  })
})

router.get('/getfile', (req, res, next) => {
  fs.readFile('result.json', (data, err) =>{
    if(!err){
      let json = JSON.parse(data)
      res.write(json)
      
    } else {
      res.write(err)
    }
    res.end()
  })
})

router.get('/mzmlweb', (req, res, next) => {
  
  filename = 'mzML/mydata.mzML';

  var mzml = new jsmzml(filename);
  
  var options = {
    'level': '1',
    'rtBegin': 0,
    'rtEnd': 1
  };

  var spectra = mzml.retrieve(options, () => {
    
    res.send(mzml.spectra)
    
  });
})


module.exports = router;
