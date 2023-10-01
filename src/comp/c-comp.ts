import {Comp} from './comp'

export class C_comp implements Comp { 
  var_def_regex:RegExp
  fn_def_regex:RegExp
  constructor(){
    this.var_def_regex=new RegExp("(?:\w+\s+)([a-zA-Z_][a-zA-Z0-9_]*)")
    this.fn_def_regex= new RegExp(`^
\s*
(unsigned|signed)?
\s+
(void|int|char|short|long|float|double)  # return type
\s+
(\w+)                                    # function name
\s*
\(
[^)]*                                    # args - total cop out
\)
\s*
;`)
  }
  conditionals(str:string):boolean {
    switch (str.replace(/\s/g, "").split("(")[0]){
      case "else":
      case "if" :
      case "else if":
        return true
      default:
        return false
    }
  }
  loops(str: string): boolean {
    if (str.startsWith("do")){return true}
    switch (str.replace(/\s/g, "").split("(")[0]){
      case "while" :
      case "for":
        return true
    }
    return false
  }

  switch_def(str: string): boolean {
      return str.startsWith("switch")
  }

  var_def(str: string): boolean | null {
    return this.var_def_regex.test(str)
  }

  type_def(str: string): boolean | null {
      return str.startsWith("structure")
  }

  fn_def(str: string): boolean | null {
    return this.fn_def_regex.test(str)
  }

  format(str: string): string {
      return str.replaceAll("\n", " ")
  }
}
