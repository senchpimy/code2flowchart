var num = 0
function getText(){
  const input = document.getElementById('message') as HTMLInputElement | null;
  num = num + 1
  
  const value = input?.value;
  console.log(value) // 👉️ "Initial value"
  console.log(num) // 👉️ "Initial value"
  
  if (input != null) {
    console.log(input.value); // 👉️ "Initial value"
  }
}
