# Learning notes

## JWT Pizza code study and debugging

As part of `Deliverable ⓵ Development deployment: JWT Pizza`, start up the application and debug through the code until you understand how it works. During the learning process fill out the following required pieces of information in order to demonstrate that you have successfully completed the deliverable.


| User activity                                                       | Frontend component | Backend endpoints | Database SQL                                                                                                                 |
| ------------------------------------------------------------------- | ------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| View home page                                                      | home.jsx           | none              | none                                                                                                                         |
| Register new user ([t@jwt.com](mailto:t@jwt.com), pw: test)         | register.jsx       | [POST] /api/auth  | `INSERT INTO user (name, email, password) VALUES (?, ?, ?)` <br/> `INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)` |
| Login new user ([t@jwt.com](mailto:t@jwt.com), pw: test)            |                    |                   |                                                                                                                              |
| Order pizza                                                         |                    |                   |                                                                                                                              |
| Verify pizza                                                        |                    |                   |                                                                                                                              |
| View profile page                                                   |                    |                   |                                                                                                                              |
| View franchise (as diner)                                           |                    |                   |                                                                                                                              |
| Logout                                                              |                    |                   |                                                                                                                              |
| View About page                                                     |                    |                   |                                                                                                                              |
| View History page                                                   |                    |                   |                                                                                                                              |
| Login as franchisee ([f@jwt.com](mailto:f@jwt.com), pw: franchisee) |                    |                   |                                                                                                                              |
| View franchise (as franchisee)                                      |                    |                   |                                                                                                                              |
| Create a store                                                      |                    |                   |                                                                                                                              |
| Close a store                                                       |                    |                   |                                                                                                                              |
| Login as admin ([a@jwt.com](mailto:a@jwt.com), pw: admin)           |                    |                   |                                                                                                                              |
| View Admin page                                                     |                    |                   |                                                                                                                              |
| Create a franchise for [t@jwt.com](mailto:t@jwt.com)                |                    |                   |                                                                                                                              |
| Close the franchise for [t@jwt.com](mailto:t@jwt.com)               |                    |                   |                                                                                                                              |


