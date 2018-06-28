//
// Lowdb code example
// See https://github.com/typicode/lowdb
//
//import low from 'lowdb'
//import LocalStorage from 'lowdb/adapters/LocalStorage'

const low=require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

const adapter = new FileSync('db2.json')
//const db = low(adapter)

// LocalStorage is a lowdb adapter for saving to localStorage
//const adapter = new LocalStorage('db')

// Create database instance
const db = low(adapter)

db.defaults({ posts: [] })
  .write()

const result = db.get('posts')
  .push({ name: "4444" })
  .write()

console.log(result)

// // Set default state
// db.defaults({ items: [] })
//   .write()
//
// function add() {
//   db.get('items')
//     .push({ time: Date.now() })
//     .write()
// }
//
// function reset() {
//   db.set('items', [])
//     .write()
// }
//
// //
// // UI code using vanilla JavaScript
// // You can use any other UI lib with lowdb
// //
//
// function render() {
//   const state = db.getState()
//   const str = JSON.stringify(state, null, 2)
//   document.getElementById('state').innerHTML = str
// }
//
// document.getElementById('reset').onclick = function() {
//   reset()
//   render()
// }
//
// document.getElementById('add').onclick = function() {
//   add()
//   render()
// }
//
// render()


