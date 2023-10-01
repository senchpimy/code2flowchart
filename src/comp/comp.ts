export class Comp_obj {
  conditionals: Function|null
  loops: Function|null
  switch_def:Function|null
  var_def: Function|null
  type_def:Function|null
  fn_def: Function|null

  constructor(){
    this.conditionals=null
    this.switch_def=null
    this.loops=null
    this.var_def=null
    this.loops=null
    this.var_def=null
    this.type_def=null
    this.fn_def=null
  }

};

export interface Comp{
  /*lenguage parsing*/
  format(str:string):string
  conditionals(str:string):boolean|null
  loops(str:string):boolean|null
  switch_def(str:string):boolean|null
  var_def(str:string):boolean|null
  type_def(str:string):boolean|null
  fn_def(str:string):boolean|null

}
