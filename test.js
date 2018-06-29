//
// Lowdb code example
// See https://github.com/typicode/lowdb
//
//import low from 'lowdb'
//import LocalStorage from 'lowdb/adapters/LocalStorage'
const   csvtojson=require( 'csvtojson/v2');

async function main(){

  const csvStr="0x23ACF1f7136DF03e0fCc407a6d5CAFa4fbD5Ea8F,1\n" +
  "0x23aF24941e7E2C17f835F31Bc113DfAb134fa302,2\n" +
  "0x23BD179C4ac8128abC9706fb0E61A4b4dEe9D672,3\n" +
  "0x24896b0180D6a33Fb5205C9cbF72e65A4f762C9f,4\n" +
  "0x24CA6d19De4763cfA04F244BCC75329F1c416e84,5\n"

  const addressAmount=[]
  const result = await csvtojson({
    noheader: true,
    output: "csv"
  }).fromString(csvStr)
    .subscribe((csv) => {
      let el = {};
      Object.defineProperty(el, csv[0], {
        value: csv[1],
        writable: true,
        configurable: true,
        enumerable: true,
      });
      addressAmount.push(el)

    })
    .then((csvRow) => {
      return addressAmount
    })
  console.log(result)
}

main()


