import { C_comp } from "./comp/c-comp";

var num = 0
var c_comp = new C_comp();

function getText(){
  const input = document.getElementById('message') as HTMLInputElement | null;
  num = num + 1
  
  const value = input?.value;
  let value_for = c_comp.format(value)
  console.log(value_for)
}
document.getElementById ("send-code").addEventListener ("click", getText, false);
