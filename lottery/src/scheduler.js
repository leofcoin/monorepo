const tasks = []

const timeout = () => setTimeout(async () => {
  console.log(tasks);
  const result = await Promise.all([...tasks])
  console.log(result);
  timeout()
}, 60000);

timeout()

const scheduler = {
  add: (task) => {
    tasks.push(task)
  },

  remove: task => {
    const index = tasks.indexOf(task)
    tasks.splice(index)
  }
}

globalThis.taskScheduler = scheduler
export default scheduler
