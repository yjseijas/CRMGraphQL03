const Usuario = require('../models/Usuario');
const Producto = require('../models/Producto');
const Cliente = require('../models/Cliente');
const Pedido = require('../models/Pedido');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({path: 'variables.env'});

const crearToken = (usuario, secreta, expiresIn) => {
  
  //console.log(usuario);

  const {id, email, nombre, apellido} = usuario;

  return jwt.sign( {id, email, nombre, apellido }, secreta, {expiresIn});
}

//resolvers
const resolvers = {
    Query : {

        obtenerUsuario: async (_, { }, ctx) => {
          //const usuarioId = await jwt.verify(token, process.env.SECRETA);
          //return usuarioId;

          return ctx.usuario;

        },
        obtenerProductos: async () => {
          try {
            const productos = await Producto.find({});
            return productos;

          } catch (error) {
            console.log(error)
          }
        },
        obtenerProducto: async (_, {id}) => {
          //revisar si el producto existe
          const producto = await Producto.findById(id);

          if (!producto) {
            throw new Error('Producto no encontrado');
          }

          return producto;
        },
        obtenerClientes: async () => {
          try {
            const clientes = await Cliente.find({});
            //console.log(clientes);
            return clientes;
          } catch (error) {
            console.log(error);
          }
        },
        obtenerClientesVendedor: async (_, {}, ctx) => {
          try {
            const clientes = await Cliente.find({ vendedor: ctx.usuario.id.toString() });
            console.log('CLUENTE!!!!',clientes);
            return clientes;
          } catch (error) {
            console.log(error);
          }
        },
        obtenerCliente: async (_, {id}, ctx) => {
            //revisar si el cliente existe
            const cliente = await Cliente.findById(id);
            if (!cliente) {
              throw new Error('Cliente no encontrado');
            }
            //Quien lo creó puede verlo
            if (cliente.vendedor.toString() != ctx.usuario.id) {
              throw new Error('No tienes las credenciales');
            }

            return cliente;
        },
        obtenerPedidos: async () => {
          try {
            return await Pedido.find({});
          } catch (error) {
            console.log(error)
          }         
        },
        obtenerPedidosVendedor: async (_, {}, ctx) => {
          try {
            return await Pedido.find({vendedor: ctx.usuario.id}).populate('cliente');
          } catch (error) {
            console.log(error)
          }         
        },
        obtenerPedido: async (_, {id}, ctx) => {
            //si el pedido existe
            const pedido = await Pedido.findById(id);
            if (!pedido) {
              throw new Error('Pedido no encontrado.');
            }

            //solamente quien lo creo
            if (pedido.vendedor.toString() !== ctx.usuario.id) {
              throw new Error('No tienes las credenciales');
            }

            return pedido;
        },
        obtenerPedidosEstado: async (_, {estado}, ctx) => {
          return await Pedido.find({vendedor: ctx.usuario.id, estado});

        },
        mejoresClientes: async () => {
          const clientes = await Pedido.aggregate([
            {$match: {estado: "COMPLETADO"}},
            {$group: {
              _id: "$cliente",
              total: {$sum: '$total' }
            }},
            {
              $lookup: {
                from: 'clientes',
                localField: '_id',
                foreignField: "_id",
                as: "cliente"
              }
            },
            {
              $limit: 10
            },
            {
              $sort: {total: -1}
            }
          ]);

          return clientes;
        }, 
        mejoresVendedores: async () => {
          const vendedores = await Pedido.aggregate([
            { $match: {estado: "COMPLETADO"}},
            { $group: {
              _id: "$vendedor",
              total: {$sum: '$total'}
            }},
            {
              $lookup: {
                from: 'usuarios',
                localField: '_id',
                foreignField: '_id',
                as: 'vendedor'
              }
            },
            {
              $limit: 3
            },
            {
              $sort: {total: -1}
            }           
          ]);
          return vendedores;  
        } ,
        buscarProducto: async (_, {texto}) => {
          const productos = await Producto.find({ $text: {$search: texto}}).limit(10);
    
          return productos;
        }     
    },
    Mutation: {
      nuevoUsuario: async (_, {input}) => {
          //console.log(input);
            const {email, password} = input;
          //Revisar si el usuario está registrado
            const existeUsuario = await Usuario.findOne({email});

            if (existeUsuario) {
                throw new Error('El usuario ya está registrado...');
            }
           // console.log(existeUsuario);
          //Hashear password
            const salt = await bcryptjs.genSaltSync(10);

            input.password = await bcryptjs.hash(password, salt);

          //Guardarlo en la BDD
          try {
              const usuario = new Usuario(input);
              usuario.save();
              return usuario;

          } catch (error) {
              console.log('Error al guardar el usuario...', error);
          }
      } ,

      autenticarUsuario : async (_, {input}) => {
        const {email, password} = input;
        //si el usuario existe
        const existeUsuario = await Usuario.findOne({email});

        if (!existeUsuario) {
            throw new Error('El usuario no existe...');
        }

        //revisar si el password es correcto
        const passwordCorrecto = await bcryptjs.compare(password, existeUsuario.password);

        if (!passwordCorrecto) {
          throw new Error('El password es incorrecto');
      }

      //crear un token

      return {
        token: crearToken(existeUsuario, process.env.SECRETA, '2400h')
      }
    },
    nuevoProducto: async (_,{input}) => {
        try {
          const producto = new Producto(input);

          //almacenar en la bdd
          const resultado = await producto.save();

          return resultado;
        } catch (error) {
          console.log(error);
        }
    },
    actualizarProducto: async (_, {id, input}) => {
        //revisar si el producto existe
        let  producto = await Producto.findById(id);

        if (!producto) {
          throw new Error('Producto no encontrado');
        }
      
        //guardarlo en la base de datos
        producto = await Producto.findOneAndUpdate({_id: id}, input, {new: true});

        return producto;
    },
    eliminarProducto: async (_, {id}) => {
         //revisar si el producto existe
         
         let  producto = await Producto.findById(id);
        
         if (!producto) {
         
           throw new Error('Producto no encontrado');
         }
         
         //eliminar
         try {
            await Producto.findByIdAndDelete({_id: id});
            return 'Producto eliminado';
         } catch (error) {
           console.log(error);
         }         
    },
    nuevoCliente: async (_, {input}, ctx) => {
      //console.log(ctx)
      //verificar si el cliente ya está registrado
      const {email} = input;
      const cliente = await Cliente.findOne({email});

      if (cliente) {
        throw new Error('Ese cliente ya está registrado.');
      }
      //console.log(input)
      const nuevoCliente = new Cliente(input);

      //asignar el vendedor
      nuevoCliente.vendedor = ctx.usuario.id;
      //guardarlo en la bdd
      try {
          const resultado = await nuevoCliente.save();
          return resultado;       
      } catch (error) {
          console.log(error);
      }

    },
    actualizarCliente: async (_, {id, input}, ctx) => {
      //verificar si existe o no
      let cliente = await Cliente.findById(id);

      if (!cliente) {
        throw new Error('Ese cliente no existe');
      }
      //verificar si está autirizado
            //Quien lo creó puede verlo
            if (cliente.vendedor.toString() != ctx.usuario.id) {
              throw new Error('No tienes las credenciales');
            }
      //guardar el cliente
      return await Cliente.findOneAndUpdate({_id: id}, input, {new: true});
    },
    eliminarCliente: async (_, {id}, ctx) => {
      //verificar si existe o no
      let cliente = await Cliente.findById(id);

      if (!cliente) {
        throw new Error('Ese cliente no existe');
      }
      //verificar si está autirizado
            //Quien lo creó puede verlo
            if (cliente.vendedor.toString() != ctx.usuario.id) {
              throw new Error('No tienes las credenciales');
            }
      //eliminar el cliente
      try {
        await Cliente.findOneAndDelete({_id: id});
        return "Cliente eliminado";       
      } catch (error) {
        console.log('Error al eliinar cliente', error);
      }
    },
    nuevoPedido: async (_, {input}, ctx) => {
//      console.log('CTXXX', ctx)

      const {cliente} = input;
        //Verificar si existe el cliente
      let clienteExiste = await Cliente.findById(cliente);

      //console.log('input', input)
      //console.log('Cliente existe', clienteExiste)
      if (!clienteExiste) {
        throw new Error('Ese cliente no existe');
      }
      //Verificar si el cliente es del vendedor
      if (clienteExiste.vendedor.toString() != ctx.usuario.id) {
        throw new Error('No tienes las credenciales');
      }   
      //revisar stock disponible
     for await (const articulo of input.pedido) {
        const {id} = articulo;
        const producto = await Producto.findById(id);

        if (articulo.cantidad > producto.existencia) {
          throw new Error(`El artículo: ${producto.nombre} excede la cantidad disponible`);
        }else {
          //Restar la cabntidad a los disponible
          producto.existencia = producto.existencia - articulo.cantidad;
          await producto.save();
        }
      }
      //crear un nuevo pedido
      const nuevoPedido = new Pedido(input);

      //asignarle un vendedor

      nuevoPedido.vendedor = ctx.usuario.id;
      
      //guardarlo en a bdd
      return await nuevoPedido.save();
      //
    },
    actualizarPedido: async(_, {id, input}, ctx) => {
      const {cliente} = input;

      //si el pedido existe
      const existePedido = await Pedido.findById(id);
      if (!existePedido) {
        throw new Error('Pedido no existe.');
      }

      //si el cliente existe
      const existeCliente = await Cliente.findById(cliente);
      if (!existeCliente) {
        throw new Error('Cliente no existe.');
      }
      //si el cliente y el pedido pertenece al vendedor
      if (existeCliente.vendedor.toString() != ctx.usuario.id) {
        throw new Error('No tienes las credenciales');
      }
      //revisar el stock
      if (input.pedido) {
        for await (const articulo of input.pedido) {
          const {id} = articulo;
          const producto = await Producto.findById(id);
  
          if (articulo.cantidad > producto.existencia) {
            throw new Error(`El artículo: ${producto.nombre} excede la cantidad disponible`);
          }else {
            //Restar la cabntidad a los disponible
            producto.existencia = producto.existencia - articulo.cantidad;
            await producto.save();
          }
        }
      }

      // Guardar el pedido
      return await Pedido.findOneAndUpdate({_id: id}, input, {new: true});
    },
    eliminarPedido: async (_, {id}, ctx) => {
      //Verificar si el pedido existe
      const pedido = await Pedido.findById(id);
      if (!pedido) {
        throw new Error('Pedido no existe.');
      }
      //verificar si el vendedor es quien lo intenta borrar
      if (pedido.vendedor.toString() != ctx.usuario.id) {
        throw new Error('No tienes las credenciales');
      }
      //eliminar de la BDD
      try {
        await Pedido.findOneAndDelete({_id: id});
        return 'Pedido Eliminado'
      } catch (error) {
        throw new Error('No se puedo eliminar el pedido');
      }      
    }
  }
}

module.exports = resolvers;